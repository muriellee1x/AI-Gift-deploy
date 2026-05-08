import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { createAndEnqueueTask } from '@/lib/task/service'
import { TASK_TYPE } from '@/lib/task/types'
import { findGift } from '@/lib/reskin/gifts'

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json()
  const { giftKey, themeKeyword } = body as {
    giftKey?: string
    themeKeyword?: string
  }

  if (!giftKey) throw new ApiError('BAD_REQUEST', 'giftKey is required')
  if (!themeKeyword?.trim()) throw new ApiError('BAD_REQUEST', 'themeKeyword is required')
  if (!findGift(giftKey)) throw new ApiError('BAD_REQUEST', `未知礼物 key: ${giftKey}`)

  const taskId = await createAndEnqueueTask({
    userId: session.user.id,
    projectId: 'reskin',
    type: TASK_TYPE.RESKIN_GENERATE_IMAGE_PROMPT,
    targetType: 'reskin',
    targetId: 'generate-image-prompt',
    payload: { giftKey, themeKeyword: themeKeyword.trim() },
  })

  return NextResponse.json({ taskId })
})
