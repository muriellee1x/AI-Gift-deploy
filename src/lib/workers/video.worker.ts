import { Worker, type Job } from 'bullmq'
import { queueRedis } from '@/lib/redis'
import { QUEUE_NAME } from '@/lib/task/queues'
import { TASK_TYPE, type TaskJobData } from '@/lib/task/types'
import { withTaskLifecycle } from './shared'
import { handleFissionVideoTask } from './handlers/fission-video'
import { handlePipelineWorkflowTask } from './handlers/pipeline-workflow'

async function processVideoTask(job: Job<TaskJobData>) {
  switch (job.data.type) {
    case TASK_TYPE.PIPELINE_RUN_WORKFLOW:
      return await handlePipelineWorkflowTask(job)
    case TASK_TYPE.FISSION_GENERATE_VIDEO:
      return await handleFissionVideoTask(job)
    default:
      throw new Error(`Unsupported video task type: ${job.data.type}`)
  }
}

export function createVideoWorker() {
  return new Worker<TaskJobData>(
    QUEUE_NAME.VIDEO,
    async (job) => await withTaskLifecycle(job, processVideoTask),
    {
      connection: queueRedis,
      concurrency: Number.parseInt(process.env.QUEUE_CONCURRENCY_VIDEO || '5', 10) || 5,
    },
  )
}
