export const TASK_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELED: 'canceled',
} as const

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS]

export const TASK_EVENT_TYPE = {
  CREATED: 'task.created',
  PROCESSING: 'task.processing',
  PROGRESS: 'task.progress',
  COMPLETED: 'task.completed',
  FAILED: 'task.failed',
} as const

export type TaskEventType = (typeof TASK_EVENT_TYPE)[keyof typeof TASK_EVENT_TYPE]

export const TASK_TYPE = {
  PIPELINE_RUN_WORKFLOW: 'pipeline_run_workflow',
  FISSION_ANALYZE: 'fission_analyze',
  RESKIN_ANALYZE: 'reskin_analyze',
  FISSION_CHARACTER_PROMPTS: 'fission_character_prompts',
  FISSION_VIDEO_PROMPTS: 'fission_video_prompts',
  FISSION_GENERATE_VIDEO: 'fission_generate_video',
  FISSION_GENERATE_CHARACTER_IMAGE: 'fission_generate_character_image',
  FISSION_EDIT_IMAGE: 'fission_edit_image',
} as const

export type TaskType = (typeof TASK_TYPE)[keyof typeof TASK_TYPE]

export type QueueType = 'image' | 'video' | 'text'

export type TaskJobData = {
  taskId: string
  type: TaskType
  projectId: string
  targetType: string
  targetId: string
  payload?: Record<string, unknown> | null
  userId: string
}

export type CreateTaskInput = {
  userId: string
  projectId: string
  type: TaskType
  targetType: string
  targetId: string
  payload?: Record<string, unknown> | null
  dedupeKey?: string | null
  priority?: number
  maxAttempts?: number
}
