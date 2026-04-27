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
  const { videoStorageKey, videoDescription, mode, analysisAsset } = body as {
    videoStorageKey?: string
    videoDescription?: string
    mode?: 'full' | 'themes-only'
    analysisAsset?: Record<string, unknown>
  }

  const normalizedMode = mode === 'themes-only' ? 'themes-only' : 'full'

  if (normalizedMode === 'full') {
    if (!videoStorageKey) {
      throw new ApiError('BAD_REQUEST', 'videoStorageKey is required')
    }
  } else {
    if (!analysisAsset || typeof analysisAsset !== 'object') {
      throw new ApiError('BAD_REQUEST', 'themes-only 模式需要提供 analysisAsset')
    }
  }

  const taskId = await createAndEnqueueTask({
    userId: session.user.id,
    projectId: 'fission',
    type: TASK_TYPE.FISSION_ANALYZE,
    targetType: 'fission',
    targetId: 'analyze',
    payload: {
      mode: normalizedMode,
      videoStorageKey: videoStorageKey || '',
      videoDescription: videoDescription || '',
      analysisAsset: analysisAsset || null,
    },
  })

  return NextResponse.json({ taskId })
})
