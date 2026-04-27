import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { createAndEnqueueTask } from '@/lib/task/service'
import { TASK_TYPE } from '@/lib/task/types'
import type { PipelineKind, PipelineStage } from '@/lib/ba-pipeline'

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

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json()
  const {
    kind,
    stage,
    baConfigId,
    prompt,
    imageKey,
    videoKey,
    text,
    projectId,
  } = body as {
    kind?: PipelineKind
    stage?: PipelineStage
    baConfigId?: string
    prompt?: string
    imageKey?: string
    videoKey?: string
    text?: string
    projectId?: string
  }

  if (!kind || !VALID_KINDS.has(kind)) {
    throw new ApiError('BAD_REQUEST', `Invalid kind: ${kind}. Must be one of: ${[...VALID_KINDS].join(', ')}`)
  }
  if (!stage || !VALID_STAGES.has(stage)) {
    throw new ApiError('BAD_REQUEST', `Invalid stage: ${stage}. Must be one of: ${[...VALID_STAGES].join(', ')}`)
  }

  if (stage === 'image' && !prompt?.trim() && !imageKey) {
    throw new ApiError('BAD_REQUEST', 'prompt or imageKey is required for image stage')
  }
  if (stage === 'video' && !imageKey) {
    throw new ApiError('BAD_REQUEST', 'imageKey is required for video stage')
  }
  if (stage === 'post' && !videoKey) {
    throw new ApiError('BAD_REQUEST', 'videoKey is required for post stage')
  }

  const taskId = await createAndEnqueueTask({
    userId: session.user.id,
    projectId: projectId || `pipeline-${kind}`,
    type: TASK_TYPE.PIPELINE_RUN_WORKFLOW,
    targetType: 'pipeline',
    targetId: `${kind}:${stage}`,
    payload: {
      kind,
      stage,
      baConfigId: baConfigId || undefined,
      prompt: prompt?.trim() || undefined,
      imageKey: imageKey || undefined,
      videoKey: videoKey || undefined,
      text: text?.trim() || undefined,
    },
  })

  return NextResponse.json({ taskId })
})
