import { UnrecoverableError, type Job } from 'bullmq'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress } from '../shared'
import {
  runPipelineStage,
  type PipelineKind,
  type PipelineStage,
} from '@/lib/ba-pipeline'

const VALID_KINDS = new Set<PipelineKind>([
  'flower2',
  'flower',
  'food',
  'scene',
  'postprocessIcon',
  'postprocessGreen',
  'postprocessGeneral',
])
const VALID_STAGES = new Set<PipelineStage>(['image', 'video', 'post'])

export async function handlePipelineWorkflowTask(
  job: Job<TaskJobData>,
): Promise<Record<string, unknown>> {
  const { userId, payload } = job.data

  const kind = payload?.kind as string | undefined
  const stage = payload?.stage as string | undefined
  const prompt = payload?.prompt as string | undefined
  const text = payload?.text as string | undefined
  const imageKey = payload?.imageKey as string | undefined
  const videoKey = payload?.videoKey as string | undefined
  const baConfigId = payload?.baConfigId as string | undefined

  if (!kind || !VALID_KINDS.has(kind as PipelineKind)) {
    throw new Error(`Invalid pipeline kind: ${kind}`)
  }
  if (!stage || !VALID_STAGES.has(stage as PipelineStage)) {
    throw new Error(`Invalid pipeline stage: ${stage}`)
  }

  let result: Record<string, unknown>
  try {
    result = await runPipelineStage(
      userId,
      kind as PipelineKind,
      stage as PipelineStage,
      {
        baConfigId,
        prompt,
        text,
        imageKey,
        videoKey,
      },
      async (pct, message) => {
        await reportTaskProgress(job, pct)
        console.log(`[Pipeline] ${kind}/${stage} progress: ${pct}% - ${message}`)
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new UnrecoverableError(message)
  }

  return {
    ...result,
    pipelineKind: kind,
    pipelineStage: stage,
  }
}
