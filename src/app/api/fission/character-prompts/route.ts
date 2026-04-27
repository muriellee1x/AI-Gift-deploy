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
  const { analysisAsset, selectedThemes } = body as {
    analysisAsset?: Record<string, unknown>
    selectedThemes?: unknown[]
  }

  if (!analysisAsset || typeof analysisAsset !== 'object') {
    throw new ApiError('BAD_REQUEST', 'analysisAsset is required')
  }
  if (!selectedThemes || selectedThemes.length === 0) {
    throw new ApiError('BAD_REQUEST', '至少需要选择一个裂变主题')
  }

  const taskId = await createAndEnqueueTask({
    userId: session.user.id,
    projectId: 'fission',
    type: TASK_TYPE.FISSION_CHARACTER_PROMPTS,
    targetType: 'fission',
    targetId: 'character-prompts',
    payload: { analysisAsset, selectedThemes },
  })

  return NextResponse.json({ taskId })
})
