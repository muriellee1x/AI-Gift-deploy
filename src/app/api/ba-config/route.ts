import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { resolveBenchBaseUrl } from '@/lib/ba-auth'

export const GET = apiHandler(async () => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const configs = await prisma.baConfig.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  const list = configs.map((c) => ({
    id: c.id,
    name: c.name,
    roomUrl: c.roomUrl,
    benchBaseUrl: c.benchBaseUrl,
    hasCookie: !!c.cookieHeader,
    cookieObtainedAt: c.cookieObtainedAt,
    isDefault: c.isDefault,
    createdAt: c.createdAt,
  }))

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
