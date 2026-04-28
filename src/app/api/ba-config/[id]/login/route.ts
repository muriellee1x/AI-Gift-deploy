import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { resolveBenchBaseUrl } from '@/lib/ba-auth'

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

  return NextResponse.json({
    success: true,
    loginUrl: benchBaseUrl,
    message: '请在新窗口中登录 ByteArtist，登录完成后回到此页面粘贴 Cookie。',
  })
})
