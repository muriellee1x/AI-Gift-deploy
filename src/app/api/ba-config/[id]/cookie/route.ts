import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { acquireCookie, resolveBenchBaseUrl } from '@/lib/ba-auth'
import { encryptApiKey } from '@/lib/crypto-utils'

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

  const benchBaseUrl = config.benchBaseUrl || resolveBenchBaseUrl(config.roomUrl)

  try {
    const cookieHeader = await acquireCookie(benchBaseUrl)

    await prisma.baConfig.update({
      where: { id },
      data: {
        benchBaseUrl,
        cookieHeader: encryptApiKey(cookieHeader),
        cookieObtainedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Cookie 获取成功',
      cookieObtainedAt: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new ApiError('INTERNAL', `Cookie 获取失败: ${msg}`)
  }
})
