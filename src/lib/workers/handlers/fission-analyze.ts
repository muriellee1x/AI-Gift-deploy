import { type Job, UnrecoverableError } from 'bullmq'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress } from '../shared'
import { buildPrompt, PROMPT_IDS } from '@/lib/prompt-i18n'
import { callUserLLM } from '@/lib/llm-call'
import { callUserMultimodalLLM, type ContentPart } from '@/lib/llm-multimodal-call'
import { getObjectBuffer, extractStorageKey } from '@/lib/storage'
import { extractFrames } from '@/lib/video-frames'

type AnalysisAsset = Record<string, unknown>
type ThemeItem = Record<string, unknown> & {
  theme_id?: string
  theme_source?: 'recommendation' | 'user_input'
  title?: string
  description?: string
  visual?: string
}

function parseJsonBlock(text: string): unknown {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('LLM 返回内容中未找到有效 JSON')
  }
  return JSON.parse(cleaned.substring(first, last + 1))
}

function isLLMConfigError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /401|403|404|API Key|Base URL|模型.*不存在/.test(msg)
}

async function runThemeRecommend(
  userId: string,
  analysisAsset: AnalysisAsset,
): Promise<ThemeItem[]> {
  const themePrompt = buildPrompt({
    promptId: PROMPT_IDS.FISSION_THEME_RECOMMEND,
    locale: 'zh',
    variables: { analysis_asset: JSON.stringify(analysisAsset) },
  })

  let themeResponse: string
  try {
    themeResponse = await callUserLLM(userId, [{ role: 'user', content: themePrompt }])
  } catch (err) {
    if (isLLMConfigError(err)) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new UnrecoverableError(msg)
    }
    throw err
  }

  const themeResult = parseJsonBlock(themeResponse) as { video_theme?: ThemeItem[] }
  if (!themeResult.video_theme || !Array.isArray(themeResult.video_theme)) {
    throw new Error('主题推荐未返回 video_theme 数组')
  }

  return themeResult.video_theme.map((t, index) => ({
    theme_source: 'recommendation',
    theme_id: t.theme_id || `theme_${index + 1}`,
    ...t,
  }))
}

export async function handleFissionAnalyzeTask(
  job: Job<TaskJobData>,
): Promise<Record<string, unknown>> {
  const { userId, payload } = job.data
  const mode = (payload?.mode as string) || 'full'

  if (mode === 'themes-only') {
    const analysisAsset = payload?.analysisAsset as AnalysisAsset | undefined
    if (!analysisAsset) throw new Error('themes-only 模式需要提供 analysisAsset')

    await reportTaskProgress(job, 10)
    const themes = await runThemeRecommend(userId, analysisAsset)
    await reportTaskProgress(job, 100)
    return { analysisAsset, themes }
  }

  const videoStorageKey = payload?.videoStorageKey as string | undefined
  const videoDescription = (payload?.videoDescription as string) || ''
  if (!videoStorageKey) throw new Error('videoStorageKey is required')

  await reportTaskProgress(job, 5)

  const key = extractStorageKey(videoStorageKey) || videoStorageKey
  const videoBuffer = await getObjectBuffer(key)

  await reportTaskProgress(job, 15)

  const { frames, durationSec } = await extractFrames(videoBuffer, { fps: 6, maxFrames: 90 })
  const frameTimeline = frames
    .map((frame, index) => `帧${index + 1}: ${frame.timestampSec.toFixed(2)}s`)
    .join('\n')

  await reportTaskProgress(job, 20)

  const analyzePromptText = buildPrompt({
    promptId: PROMPT_IDS.FISSION_ANALYZE_VIDEO,
    locale: 'zh',
    variables: {
      video_description: videoDescription || '无',
      frame_count: String(frames.length),
      video_duration: durationSec.toFixed(2),
      frame_timeline: frameTimeline,
    },
  })

  const contentParts: ContentPart[] = [
    ...frames.map((frame): ContentPart => ({
      type: 'image_url',
      image_url: { url: frame.dataUrl },
    })),
    { type: 'text', text: analyzePromptText },
  ]

  let analyzeResponse: string
  try {
    analyzeResponse = await callUserMultimodalLLM(userId, contentParts)
  } catch (err) {
    if (isLLMConfigError(err)) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new UnrecoverableError(msg)
    }
    throw err
  }

  await reportTaskProgress(job, 50)

  const analyzeResult = parseJsonBlock(analyzeResponse) as { analysis_asset?: AnalysisAsset }
  const analysisAsset = analyzeResult.analysis_asset
  if (!analysisAsset || typeof analysisAsset !== 'object') {
    throw new Error('视频分析未返回 analysis_asset 对象')
  }

  await reportTaskProgress(job, 60)

  const themes = await runThemeRecommend(userId, analysisAsset)

  await reportTaskProgress(job, 100)

  return { analysisAsset, themes }
}
