import { UnrecoverableError, type Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import {
  markTaskProcessing,
  markTaskCompleted,
  markTaskFailed,
  updateTaskProgress,
} from '@/lib/task/service'
import type { TaskJobData } from '@/lib/task/types'

export async function reportTaskProgress(job: Job<TaskJobData>, progress: number) {
  try {
    await updateTaskProgress(job.data.taskId, progress)
    await job.updateProgress(progress)
  } catch {
    // swallow progress reporting errors
  }
}

export async function withTaskLifecycle(
  job: Job<TaskJobData>,
  handler: (job: Job<TaskJobData>) => Promise<Record<string, unknown> | void>,
) {
  const { taskId } = job.data

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task || task.status === 'canceled') {
    throw new UnrecoverableError('Task not found or canceled')
  }

  await markTaskProcessing(taskId)

  try {
    const result = await handler(job)
    await markTaskCompleted(taskId, result ?? {})
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await markTaskFailed(taskId, message)
    throw error
  }
}
