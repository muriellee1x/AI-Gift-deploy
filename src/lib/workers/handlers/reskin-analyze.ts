import { type Job, UnrecoverableError } from 'bullmq'
import path from 'path'
import os from 'os'
import fs from 'fs'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress } from '../shared'
import { buildPrompt, PROMPT_IDS } from '@/lib/prompt-i18n'
import { callUserLLM } from '@/lib/llm-call'
import { callUserMultimodalLLM, type ContentPart } from '@/lib/llm-multimodal-call'
import { getObjectBuffer, extractStorageKey } from '@/lib/storage'
import { extractFrames } from '@/lib/video-frames'
import { findGift, assertR2Configured } from '@/lib/reskin/gifts'

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

async function fetchVideoBuffer(videoUrl: string): Promise<Buffer> {
  const res = await fetch(videoUrl, { signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`下载礼物视频失败: ${res.status} (${videoUrl})`)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

export async function handleReskinAnalyzeTask(
  job: Job<TaskJobData>,
): Promise<Record<string, unknown>> {
  const { userId, payload } = job.data
  const giftKey = payload?.giftKey as string | undefined
  const imageStorageKey = payload?.imageStorageKey as string | undefined

  if (!giftKey || !imageStorageKey) {
    throw new UnrecoverableError('giftKey and imageStorageKey are required')
  }

  assertR2Configured()

  const gift = findGift(giftKey)
  if (!gift) throw new UnrecoverableError(`未知礼物 key: ${giftKey}`)

  await reportTaskProgress(job, 5)

  const imageKey = extractStorageKey(imageStorageKey) || imageStorageKey
  const [videoBuffer, imageBuffer] = await Promise.all([
    fetchVideoBuffer(gift.videoUrl),
    getObjectBuffer(imageKey),
  ])

  await reportTaskProgress(job, 15)

  const { frames, durationSec } = await extractFrames(videoBuffer, { fps: 6, maxFrames: 90 })
  const frameTimeline = frames
    .map((frame, index) => `帧${index + 1}: ${frame.timestampSec.toFixed(2)}s`)
    .join('\n')
  const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`

  // Write video to a temp file so ffmpeg can access it (extractFrames may need it)
  const tmpPath = path.join(os.tmpdir(), `reskin-${Date.now()}.mp4`)
  try {
    fs.writeFileSync(tmpPath, videoBuffer)
  } catch {
    // ignore if already written via extractFrames
  }

  await reportTaskProgress(job, 25)

  const analysePromptText = buildPrompt({
    promptId: PROMPT_IDS.RESKIN_ANALYSE,
    locale: 'zh',
    variables: {
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
    {
      type: 'image_url',
      image_url: { url: imageDataUrl },
    },
    {
      type: 'text',
      text: analysePromptText,
    },
  ]

  let analyseResponse: string
  try {
    analyseResponse = await callUserMultimodalLLM(userId, contentParts)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/401|403|404|API Key|Base URL|模型.*不存在/.test(msg)) {
      throw new UnrecoverableError(msg)
    }
    throw err
  } finally {
    try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
  }

  await reportTaskProgress(job, 55)

  const analyseResult = parseJsonBlock(analyseResponse) as {
    reskin_analyze?: Array<{
      video_analyze: string
      image_analyze: string
    }>
  }

  if (!analyseResult.reskin_analyze || !Array.isArray(analyseResult.reskin_analyze)) {
    throw new Error('换肤分析未返回 reskin_analyze 数组')
  }

  const reskinAnalyze = JSON.stringify(analyseResult.reskin_analyze)

  await reportTaskProgress(job, 65)

  const videoPromptText = buildPrompt({
    promptId: PROMPT_IDS.RESKIN_VIDEO_PROMPT,
    locale: 'zh',
    variables: {
      reskin_analyze: reskinAnalyze,
    },
  })

  let videoPromptResponse: string
  try {
    videoPromptResponse = await callUserLLM(userId, [{ role: 'user', content: videoPromptText }])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/401|403|404|API Key|Base URL|模型.*不存在/.test(msg)) {
      throw new UnrecoverableError(msg)
    }
    throw err
  }

  const parsedPrompt = parseJsonBlock(videoPromptResponse) as { video_prompt?: string }
  if (!parsedPrompt.video_prompt) {
    throw new Error('换肤提示词生成未返回 video_prompt 字段')
  }

  await reportTaskProgress(job, 100)

  return {
    reskin_analyze: analyseResult.reskin_analyze,
    video_prompt: parsedPrompt.video_prompt,
  }
}
