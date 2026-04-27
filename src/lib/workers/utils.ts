import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { TaskTerminatedError } from '@/lib/task/errors'
import type { TaskJobData } from '@/lib/task/types'

export async function assertTaskActive(job: Job<TaskJobData>, label?: string) {
  const task = await prisma.task.findUnique({
    where: { id: job.data.taskId },
    select: { status: true },
  })
  if (!task || task.status === 'canceled') {
    throw new TaskTerminatedError(
      `Task ${job.data.taskId} terminated at ${label ?? 'unknown'}`,
    )
  }
}
