import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { decryptApiKey } from '@/lib/crypto-utils'
import { testConnection } from '@/lib/ba-client'

export const POST = apiHandler(async (
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult
  const { id } = await context.params

  const config = await prisma.baConfig.findUnique({ where: { id } })
  if (!config || config.userId !== session.user.id) {
    throw new ApiError('NOT_FOUND')
  }

  if (!config.cookieHeader || !config.benchBaseUrl) {
    throw new ApiError('BAD_REQUEST', '请先获取 Cookie')
  }

  const cookie = decryptApiKey(config.cookieHeader)
  const result = await testConnection(config.benchBaseUrl, cookie)

  return NextResponse.json({
    success: result.ok,
    message: result.message,
    data: result.data,
  })
})
