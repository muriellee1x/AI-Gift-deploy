import { Worker, type Job } from 'bullmq'
import { queueRedis } from '@/lib/redis'
import { QUEUE_NAME } from '@/lib/task/queues'
import { TASK_TYPE, type TaskJobData } from '@/lib/task/types'
import { withTaskLifecycle } from './shared'
import { handlePipelineWorkflowTask } from './handlers/pipeline-workflow'
import { handleFissionCharacterImageTask } from './handlers/fission-character-image'
import { handleFissionEditImageTask } from './handlers/fission-edit-image'
import { handleReskinGenerateImageTask } from './handlers/reskin-generate-image'

async function processImageTask(job: Job<TaskJobData>) {
  switch (job.data.type) {
    case TASK_TYPE.PIPELINE_RUN_WORKFLOW:
      return await handlePipelineWorkflowTask(job)
    case TASK_TYPE.FISSION_GENERATE_CHARACTER_IMAGE:
      return await handleFissionCharacterImageTask(job)
    case TASK_TYPE.FISSION_EDIT_IMAGE:
      return await handleFissionEditImageTask(job)
    case TASK_TYPE.RESKIN_GENERATE_IMAGE:
      return await handleReskinGenerateImageTask(job)
    default:
      throw new Error(`Unsupported image task type: ${job.data.type}`)
  }
}

export function createImageWorker() {
  return new Worker<TaskJobData>(
    QUEUE_NAME.IMAGE,
    async (job) => await withTaskLifecycle(job, processImageTask),
    {
      connection: queueRedis,
      concurrency: Number.parseInt(process.env.QUEUE_CONCURRENCY_IMAGE || '10', 10) || 10,
    },
  )
}
