import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { openLoginBrowser, resolveBenchBaseUrl } from '@/lib/ba-auth'

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
    await openLoginBrowser(benchBaseUrl)
    return NextResponse.json({
      success: true,
      message: '浏览器已打开，请在浏览器中登录 ByteArtist。登录后可直接点击"刷新 Cookie"（无需关闭浏览器）。',
    })
  } catch (err) {
    throw new ApiError('INTERNAL', err instanceof Error ? err.message : '打开浏览器失败')
  }
})
