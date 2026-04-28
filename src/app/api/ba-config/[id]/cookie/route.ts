import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { resolveBenchBaseUrl, validateCookieFormat } from '@/lib/ba-auth'
import { encryptApiKey } from '@/lib/crypto-utils'
import { testConnection } from '@/lib/ba-client'

export const POST = apiHandler(async (
  request: NextRequest,
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

  const body = await request.json() as { cookieHeader?: unknown }
  const { cookieHeader } = body

  try {
    validateCookieFormat(cookieHeader)
  } catch (err) {
    throw new ApiError('BAD_REQUEST', err instanceof Error ? err.message : 'Cookie 格式错误')
  }

  const benchBaseUrl = config.benchBaseUrl || resolveBenchBaseUrl(config.roomUrl)

  // 强制验证：保存前先 testConnection
  const testResult = await testConnection(benchBaseUrl, cookieHeader as string)
  if (!testResult.ok) {
    throw new ApiError('BAD_REQUEST', `Cookie 验证失败: ${testResult.message}`)
  }

  await prisma.baConfig.update({
    where: { id },
    data: {
      benchBaseUrl,
      cookieHeader: encryptApiKey(cookieHeader as string),
      cookieObtainedAt: new Date(),
      cookieValid: true,
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Cookie 已保存并验证通过',
    cookieObtainedAt: new Date().toISOString(),
  })
})
