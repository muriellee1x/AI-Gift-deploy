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
  const { videoPrompt, referenceImageUrls, referenceVideoUrl, ratio, duration } = body as {
    videoPrompt?: string
    referenceImageUrls?: string[]
    referenceVideoUrl?: string
    ratio?: string
    duration?: number
  }

  if (!videoPrompt?.trim()) throw new ApiError('BAD_REQUEST', 'videoPrompt is required')

  const taskId = await createAndEnqueueTask({
    userId: session.user.id,
    projectId: 'fission',
    type: TASK_TYPE.FISSION_GENERATE_VIDEO,
    targetType: 'fission-video',
    targetId: `video-${Date.now()}`,
    payload: {
      videoPrompt,
      referenceImageUrls,
      referenceVideoUrl,
      ratio: ratio || undefined,
      duration: typeof duration === 'number' ? duration : undefined,
    },
  })

  return NextResponse.json({ taskId })
})
