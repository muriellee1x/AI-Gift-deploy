import { prisma } from '@/lib/prisma'
import { TASK_STATUS, type CreateTaskInput, type TaskJobData } from './types'
import { addTaskJob } from './queues'

export async function createAndEnqueueTask(input: CreateTaskInput): Promise<string> {
  const task = await prisma.task.create({
    data: {
      userId: input.userId,
      projectId: input.projectId,
      type: input.type,
      targetType: input.targetType,
      targetId: input.targetId,
      payload: (input.payload ?? undefined) as Parameters<typeof prisma.task.create>[0]['data']['payload'],
      dedupeKey: input.dedupeKey ?? undefined,
      status: TASK_STATUS.QUEUED,
      maxAttempts: input.maxAttempts ?? 3,
      priority: input.priority ?? 0,
    },
  })

  const jobData: TaskJobData = {
    taskId: task.id,
    type: input.type,
    projectId: input.projectId,
    targetType: input.targetType,
    targetId: input.targetId,
    payload: input.payload,
    userId: input.userId,
  }

  await addTaskJob(jobData)
  return task.id
}

export async function markTaskProcessing(taskId: string) {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: TASK_STATUS.PROCESSING,
      startedAt: new Date(),
      attempt: { increment: 1 },
    },
  })
}

export async function markTaskCompleted(taskId: string, result?: Record<string, unknown>) {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: TASK_STATUS.COMPLETED,
      finishedAt: new Date(),
      progress: 100,
      result: (result ?? undefined) as Parameters<typeof prisma.task.update>[0]['data']['result'],
    },
  })
}

export async function markTaskFailed(taskId: string, errorMessage: string) {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: TASK_STATUS.FAILED,
      finishedAt: new Date(),
      errorMessage,
    },
  })
}

export async function updateTaskProgress(taskId: string, progress: number) {
  await prisma.task.update({
    where: { id: taskId },
    data: { progress, heartbeatAt: new Date() },
  })
}
