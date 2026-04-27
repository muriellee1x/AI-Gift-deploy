import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { resolveBenchBaseUrl } from '@/lib/ba-auth'

export const PUT = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult
  const { id } = await context.params

  const existing = await prisma.baConfig.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    throw new ApiError('NOT_FOUND')
  }

  const body = await request.json()
  const { name, roomUrl, isDefault } = body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {}

  if (name !== undefined) updateData.name = name.trim()
  if (roomUrl !== undefined) {
    updateData.roomUrl = roomUrl.trim()
    try {
      updateData.benchBaseUrl = resolveBenchBaseUrl(roomUrl.trim())
    } catch {
      updateData.benchBaseUrl = null
    }
  }

  if (isDefault !== undefined) {
    updateData.isDefault = isDefault
    if (isDefault) {
      await prisma.baConfig.updateMany({
        where: { userId: session.user.id, id: { not: id } },
        data: { isDefault: false },
      })
    }
  }

  const config = await prisma.baConfig.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json({
    config: {
      id: config.id,
      name: config.name,
      roomUrl: config.roomUrl,
      benchBaseUrl: config.benchBaseUrl,
      hasCookie: !!config.cookieHeader,
      cookieObtainedAt: config.cookieObtainedAt,
      isDefault: config.isDefault,
      createdAt: config.createdAt,
    },
  })
})

export const DELETE = apiHandler(async (
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

  await prisma.baConfig.delete({ where: { id } })

  return NextResponse.json({ success: true })
})
