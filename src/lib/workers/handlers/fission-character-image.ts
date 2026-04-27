import { type Job, UnrecoverableError } from 'bullmq'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress } from '../shared'
import { runPipelineStage } from '@/lib/ba-pipeline'

export async function handleFissionCharacterImageTask(job: Job<TaskJobData>) {
  const { userId } = job.data
  const payload = (job.data.payload || {}) as Record<string, unknown>
  const prompt = payload.prompt as string | undefined
  const baConfigId = payload.baConfigId as string | undefined

  if (!prompt?.trim()) throw new UnrecoverableError('prompt is required')

  try {
    const result = await runPipelineStage(
      userId,
      'character',
      'image',
      { baConfigId, prompt },
      async (pct, message) => {
        await reportTaskProgress(job, pct)
        console.log(`[fission-character] progress: ${pct}% - ${message}`)
      },
    )

    if (result.kind !== 'image') {
      throw new Error('预期 image 输出，实际得到 ' + result.kind)
    }

    return { imageUrl: result.imageUrl, storageKey: result.imageKey }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/未配置 BA 房间|BA 配置缺少|未知工作流阶段|指定的 BA 房间不存在/.test(msg)) {
      throw new UnrecoverableError(msg)
    }
    throw err
  }
}
