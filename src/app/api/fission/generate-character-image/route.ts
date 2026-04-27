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
  const { prompt, baConfigId } = body as {
    prompt?: string
    baConfigId?: string
  }

  if (!prompt?.trim()) throw new ApiError('BAD_REQUEST', 'prompt is required')

  const taskId = await createAndEnqueueTask({
    userId: session.user.id,
    projectId: 'fission',
    type: TASK_TYPE.FISSION_GENERATE_CHARACTER_IMAGE,
    targetType: 'fission-character',
    targetId: `char-${Date.now()}`,
    payload: {
      prompt: prompt.trim(),
      baConfigId: baConfigId || undefined,
    },
  })

  return NextResponse.json({ taskId })
})
