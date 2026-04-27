import { JobsOptions, Queue } from 'bullmq'
import { queueRedis } from '@/lib/redis'
import { TASK_TYPE, type TaskType, type QueueType, type TaskJobData } from './types'

export const QUEUE_NAME = {
  IMAGE: 'aigift-image',
  VIDEO: 'aigift-video',
  TEXT: 'aigift-text',
} as const

const defaultJobOptions: JobsOptions = {
  removeOnComplete: 500,
  removeOnFail: 500,
  attempts: 1,
}

export const imageQueue = new Queue<TaskJobData>(QUEUE_NAME.IMAGE, {
  connection: queueRedis,
  defaultJobOptions,
})

export const videoQueue = new Queue<TaskJobData>(QUEUE_NAME.VIDEO, {
  connection: queueRedis,
  defaultJobOptions,
})

export const textQueue = new Queue<TaskJobData>(QUEUE_NAME.TEXT, {
  connection: queueRedis,
  defaultJobOptions,
})

const IMAGE_TYPES = new Set<TaskType>([
  TASK_TYPE.PIPELINE_RUN_WORKFLOW,
  TASK_TYPE.FISSION_GENERATE_CHARACTER_IMAGE,
  TASK_TYPE.FISSION_EDIT_IMAGE,
])

const VIDEO_TYPES = new Set<TaskType>([
  TASK_TYPE.FISSION_GENERATE_VIDEO,
])

export function getQueueTypeByTaskType(type: TaskType, payload?: Record<string, unknown> | null): QueueType {
  if (type === TASK_TYPE.PIPELINE_RUN_WORKFLOW) {
    const stage = payload?.stage
    return stage === 'video' || stage === 'post' ? 'video' : 'image'
  }
  if (IMAGE_TYPES.has(type)) return 'image'
  if (VIDEO_TYPES.has(type)) return 'video'
  return 'text'
}

export function getQueueByType(type: QueueType) {
  switch (type) {
    case 'image':
      return imageQueue
    case 'video':
      return videoQueue
    case 'text':
    default:
      return textQueue
  }
}

export async function addTaskJob(data: TaskJobData, opts?: JobsOptions) {
  const queueType = getQueueTypeByTaskType(data.type, data.payload)
  const queue = getQueueByType(queueType)
  const priority = typeof opts?.priority === 'number' ? opts.priority : 0
  return await queue.add(data.type, data, {
    jobId: data.taskId,
    priority,
    ...(opts || {}),
  })
}
