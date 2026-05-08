import { type Job, UnrecoverableError } from 'bullmq'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress } from '../shared'
import { callUserImageAPI } from '@/lib/image-call'

async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  const url = imageUrl.startsWith('http')
    ? imageUrl
    : `${process.env.APP_BASE_URL || 'http://localhost:3000'}${imageUrl}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载参考图失败: ${res.status}`)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

export async function handleReskinGenerateImageTask(
  job: Job<TaskJobData>,
): Promise<Record<string, unknown>> {
  const { userId } = job.data
  const payload = (job.data.payload || {}) as Record<string, unknown>
  const prompt = payload.prompt as string | undefined
  const refImageUrl = payload.refImageUrl as string | undefined
  const apiConfigId = payload.apiConfigId as string | undefined
  const resolution = payload.resolution as '1K' | '2K' | '4K' | undefined

  if (!prompt?.trim()) throw new UnrecoverableError('prompt is required')
  if (!refImageUrl) throw new UnrecoverableError('refImageUrl is required')

  await reportTaskProgress(job, 10)

  const refBuffer = await fetchImageBuffer(refImageUrl)

  await reportTaskProgress(job, 30)

  const result = await callUserImageAPI(userId, prompt.trim(), [refBuffer], apiConfigId, { resolution })

  await reportTaskProgress(job, 100)

  return { imageUrl: result.imageUrl, storageKey: result.storageKey }
}
