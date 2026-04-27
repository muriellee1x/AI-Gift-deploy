import { type Job, UnrecoverableError } from 'bullmq'
import { callUserVideoAPI } from '@/lib/video-call'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress } from '../shared'

export async function handleFissionVideoTask(job: Job<TaskJobData>) {
  const { userId } = job.data
  const payload = (job.data.payload || {}) as Record<string, unknown>
  const prompt = payload.videoPrompt as string | undefined
  const referenceImageUrls = payload.referenceImageUrls as string[] | undefined
  const referenceVideoUrl = payload.referenceVideoUrl as string | undefined

  if (!prompt?.trim()) throw new UnrecoverableError('videoPrompt is required')

  const ratio = (payload.ratio as string) || undefined
  const duration = typeof payload.duration === 'number' ? payload.duration : undefined

  console.log(
    `[fission-video] task=${job.data.taskId} refs=${referenceImageUrls?.length ?? 0} videoRef=${!!referenceVideoUrl} ratio=${ratio ?? '16:9'} duration=${duration ?? 5}s`,
  )

  await reportTaskProgress(job, 10)

  let result
  try {
    result = await callUserVideoAPI(userId, prompt, {
      referenceImageUrls,
      referenceVideoUrl,
      ratio,
      duration,
      onProgress: (status) => {
        if (status === 'running') {
          reportTaskProgress(job, 50).catch(() => {})
        }
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/\(400\)|\(401\)|\(403\)|\(404\)|\(429\)|InvalidParameter|API Key|Base URL|模型.*不存在|TooManyRequests|RateLimitExceeded/.test(msg)) {
      throw new UnrecoverableError(msg)
    }
    throw err
  }

  await reportTaskProgress(job, 95)

  return { videoUrl: result.videoUrl }
}
