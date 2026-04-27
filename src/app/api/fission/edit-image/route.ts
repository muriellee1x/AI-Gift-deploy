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
  const { imageUrl, prompt, apiConfigId, resolution } = body as {
    imageUrl?: string
    prompt?: string
    apiConfigId?: string
    resolution?: '1K' | '2K' | '4K'
  }

  if (!imageUrl) throw new ApiError('BAD_REQUEST', 'imageUrl is required')
  if (!prompt?.trim()) throw new ApiError('BAD_REQUEST', 'prompt is required')

  const taskId = await createAndEnqueueTask({
    userId: session.user.id,
    projectId: 'fission',
    type: TASK_TYPE.FISSION_EDIT_IMAGE,
    targetType: 'fission-edit',
    targetId: 'edit-image',
    payload: {
      imageUrl,
      prompt,
      apiConfigId: apiConfigId || undefined,
      resolution: resolution || undefined,
    },
  })

  return NextResponse.json({ taskId })
})
