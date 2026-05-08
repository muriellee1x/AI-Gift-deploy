import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { createAndEnqueueTask } from '@/lib/task/service'
import { TASK_TYPE } from '@/lib/task/types'

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json()
  const { prompt, refImageUrl, apiConfigId, resolution } = body as {
    prompt?: string
    refImageUrl?: string
    apiConfigId?: string
    resolution?: '1K' | '2K' | '4K'
  }

  if (!prompt?.trim()) throw new ApiError('BAD_REQUEST', 'prompt is required')
  if (!refImageUrl) throw new ApiError('BAD_REQUEST', 'refImageUrl is required')

  const taskId = await createAndEnqueueTask({
    userId: session.user.id,
    projectId: 'reskin',
    type: TASK_TYPE.RESKIN_GENERATE_IMAGE,
    targetType: 'reskin',
    targetId: 'generate-image',
    payload: {
      prompt: prompt.trim(),
      refImageUrl,
      apiConfigId: apiConfigId || undefined,
      resolution: resolution || undefined,
    },
  })

  return NextResponse.json({ taskId })
})
