import { type Job, UnrecoverableError } from 'bullmq'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress } from '../shared'
import { buildPrompt, PROMPT_IDS } from '@/lib/prompt-i18n'
import { callUserMultimodalLLM, type ContentPart } from '@/lib/llm-multimodal-call'
import { findGift, assertR2Configured } from '@/lib/reskin/gifts'

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const fullUrl = url.startsWith('http')
    ? url
    : `${process.env.APP_BASE_URL || 'http://localhost:3000'}${url}`
  const res = await fetch(fullUrl)
  if (!res.ok) throw new Error(`下载绿底图失败: ${res.status}`)
  const ab = await res.arrayBuffer()
  const buffer = Buffer.from(ab)
  const contentType = res.headers.get('content-type') || 'image/png'
  return `data:${contentType};base64,${buffer.toString('base64')}`
}

export async function handleReskinGenerateImagePromptTask(
  job: Job<TaskJobData>,
): Promise<Record<string, unknown>> {
  const { userId, payload } = job.data
  const giftKey = payload?.giftKey as string | undefined
  const themeKeyword = payload?.themeKeyword as string | undefined

  if (!giftKey) throw new UnrecoverableError('giftKey is required')
  if (!themeKeyword?.trim()) throw new UnrecoverableError('themeKeyword is required')

  assertR2Configured()

  const gift = findGift(giftKey)
  if (!gift) throw new UnrecoverableError(`未知礼物 key: ${giftKey}`)

  await reportTaskProgress(job, 10)

  const greenImageDataUrl = await fetchImageAsDataUrl(gift.greenImage)

  await reportTaskProgress(job, 30)

  const promptText = buildPrompt({
    promptId: PROMPT_IDS.RESKIN_IMAGE_PROMPT,
    locale: 'zh',
    variables: { theme_keyword: themeKeyword.trim() },
  })

  const contentParts: ContentPart[] = [
    {
      type: 'image_url',
      image_url: { url: greenImageDataUrl },
    },
    {
      type: 'text',
      text: promptText,
    },
  ]

  let response: string
  try {
    response = await callUserMultimodalLLM(userId, contentParts)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/401|403|404|API Key|Base URL|模型.*不存在/.test(msg)) {
      throw new UnrecoverableError(msg)
    }
    throw err
  }

  await reportTaskProgress(job, 100)

  return { imagePrompt: response.trim() }
}
