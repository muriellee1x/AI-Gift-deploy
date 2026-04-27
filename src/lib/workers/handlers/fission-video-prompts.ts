import type { Job } from 'bullmq'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress } from '../shared'
import { buildPrompt, PROMPT_IDS } from '@/lib/prompt-i18n'
import { callUserLLM } from '@/lib/llm-call'

type AnalysisAsset = Record<string, unknown>
type SelectedTheme = Record<string, unknown> & {
  title?: string
  theme_source?: 'recommendation' | 'user_input'
}

type GroupVideoPromptItem = {
  group_id: number
  video_prompt: string
  validation_report?: Record<string, unknown>
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

export async function handleFissionVideoPromptsTask(
  job: Job<TaskJobData>,
): Promise<Record<string, unknown>> {
  const { userId, payload } = job.data
  const analysisAsset = payload?.analysisAsset as AnalysisAsset | undefined
  const selectedThemes = payload?.selectedThemes as SelectedTheme[] | undefined
  const characterImagesDesc = (payload?.characterImagesDesc as string) || '无角色图像描述'

  if (!analysisAsset || typeof analysisAsset !== 'object') {
    throw new Error('analysisAsset is required')
  }
  if (!selectedThemes || selectedThemes.length === 0) {
    throw new Error('至少需要选择一个裂变主题')
  }

  await reportTaskProgress(job, 10)

  const allVideoPrompts: Array<{
    themeTitle: string
    themeIndex: number
    prompts: Array<{ group_id: number; video_prompt: string }>
  }> = []

  const progressPerTheme = 80 / selectedThemes.length
  const analysisAssetText = JSON.stringify(analysisAsset)

  for (let ti = 0; ti < selectedThemes.length; ti++) {
    const theme = selectedThemes[ti]
    const themeTitle = (theme.title as string) || `主题 ${ti + 1}`

    const prompt = buildPrompt({
      promptId: PROMPT_IDS.FISSION_VIDEO_PROMPT,
      locale: 'zh',
      variables: {
        analysis_asset: analysisAssetText,
        selected_theme: JSON.stringify(theme),
        character_images_desc: characterImagesDesc,
      },
    })

    const response = await callUserLLM(userId, [{ role: 'user', content: prompt }])

    const result = parseJsonBlock(response) as {
      group_video_prompt?: GroupVideoPromptItem[]
    }

    if (!result.group_video_prompt || !Array.isArray(result.group_video_prompt)) {
      throw new Error(`主题「${themeTitle}」未返回 group_video_prompt 数组`)
    }

    for (const item of result.group_video_prompt) {
      if (item.validation_report) {
        try {
          console.info(
            `[fission-video-prompts] theme="${themeTitle}" group=${item.group_id} validation=`,
            JSON.stringify(item.validation_report),
          )
        } catch { /* ignore */ }
      }
    }

    allVideoPrompts.push({
      themeTitle,
      themeIndex: ti,
      prompts: result.group_video_prompt.map((item) => ({
        group_id: item.group_id,
        video_prompt: item.video_prompt,
      })),
    })

    await reportTaskProgress(job, Math.round(10 + (ti + 1) * progressPerTheme))
  }

  await reportTaskProgress(job, 100)

  return { videoPrompts: allVideoPrompts }
}
