import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { resolveBenchBaseUrl } from '@/lib/ba-auth'

type CookieAgeStatus = 'green' | 'yellow' | 'red-soft' | 'red-invalid' | 'none'

function deriveCookieAgeStatus(
  cookieObtainedAt: Date | null,
  cookieValid: boolean,
  hasCookie: boolean,
): CookieAgeStatus {
  if (!hasCookie) return 'none'
  if (!cookieValid) return 'red-invalid'
  if (!cookieObtainedAt) return 'green'
  const daysAgo = (Date.now() - cookieObtainedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysAgo <= 3) return 'green'
  if (daysAgo <= 7) return 'yellow'
  return 'red-soft'
}

export const GET = apiHandler(async () => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const configs = await prisma.baConfig.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  const list = configs.map((c) => {
    const hasCookie = !!c.cookieHeader
    return {
      id: c.id,
      name: c.name,
      roomUrl: c.roomUrl,
      benchBaseUrl: c.benchBaseUrl,
      hasCookie,
      cookieObtainedAt: c.cookieObtainedAt,
      cookieValid: c.cookieValid,
      cookieAgeStatus: deriveCookieAgeStatus(c.cookieObtainedAt, c.cookieValid, hasCookie),
      isDefault: c.isDefault,
      createdAt: c.createdAt,
    }
  })

  return NextResponse.json({ configs: list })
})

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json()
  const { name, roomUrl } = body

  if (!name?.trim() || !roomUrl?.trim()) {
    throw new ApiError('BAD_REQUEST', '名称和房间 URL 均为必填')
  }

  let benchBaseUrl: string | null = null
  try {
    benchBaseUrl = resolveBenchBaseUrl(roomUrl.trim())
  } catch {
    // URL 格式无法解析 bench base，存原值，后续手动处理
  }

  const config = await prisma.baConfig.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      roomUrl: roomUrl.trim(),
      benchBaseUrl,
    },
  })

  return NextResponse.json({
    config: {
      id: config.id,
      name: config.name,
      roomUrl: config.roomUrl,
      benchBaseUrl: config.benchBaseUrl,
      hasCookie: false,
      cookieObtainedAt: null,
      isDefault: config.isDefault,
      createdAt: config.createdAt,
    },
  }, { status: 201 })
})
