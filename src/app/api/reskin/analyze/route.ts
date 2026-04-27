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
  const { videoStorageKey, imageStorageKey } = body as {
    videoStorageKey?: string
    imageStorageKey?: string
  }

  if (!videoStorageKey) {
    throw new ApiError('BAD_REQUEST', 'videoStorageKey is required')
  }

  if (!imageStorageKey) {
    throw new ApiError('BAD_REQUEST', 'imageStorageKey is required')
  }

  const taskId = await createAndEnqueueTask({
    userId: session.user.id,
    projectId: 'reskin',
    type: TASK_TYPE.RESKIN_ANALYZE,
    targetType: 'reskin',
    targetId: 'analyze',
    payload: { videoStorageKey, imageStorageKey },
  })

  return NextResponse.json({ taskId })
})
