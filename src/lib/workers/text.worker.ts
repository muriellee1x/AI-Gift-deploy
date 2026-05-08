import { Worker, type Job } from 'bullmq'
import { queueRedis } from '@/lib/redis'
import { QUEUE_NAME } from '@/lib/task/queues'
import { TASK_TYPE, type TaskJobData } from '@/lib/task/types'
import { withTaskLifecycle } from './shared'
import { handleFissionAnalyzeTask } from './handlers/fission-analyze'
import { handleFissionCharacterPromptsTask } from './handlers/fission-character-prompts'
import { handleFissionVideoPromptsTask } from './handlers/fission-video-prompts'
import { handleReskinAnalyzeTask } from './handlers/reskin-analyze'
import { handleReskinGenerateImagePromptTask } from './handlers/reskin-generate-image-prompt'

async function processTextTask(job: Job<TaskJobData>) {
  switch (job.data.type) {
    case TASK_TYPE.FISSION_ANALYZE:
      return await handleFissionAnalyzeTask(job)
    case TASK_TYPE.RESKIN_ANALYZE:
      return await handleReskinAnalyzeTask(job)
    case TASK_TYPE.RESKIN_GENERATE_IMAGE_PROMPT:
      return await handleReskinGenerateImagePromptTask(job)
    case TASK_TYPE.FISSION_CHARACTER_PROMPTS:
      return await handleFissionCharacterPromptsTask(job)
    case TASK_TYPE.FISSION_VIDEO_PROMPTS:
      return await handleFissionVideoPromptsTask(job)
    default:
      throw new Error(`Unsupported text task type: ${job.data.type}`)
  }
}

export function createTextWorker() {
  return new Worker<TaskJobData>(
    QUEUE_NAME.TEXT,
    async (job) => await withTaskLifecycle(job, processTextTask),
    {
      connection: queueRedis,
      concurrency: Number.parseInt(process.env.QUEUE_CONCURRENCY_TEXT || '10', 10) || 10,
    },
  )
}
