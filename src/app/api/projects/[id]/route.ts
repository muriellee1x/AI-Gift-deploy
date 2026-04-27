import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'

export const GET = apiHandler(async (
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult
  const { id } = await context.params

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project || project.userId !== session.user.id) {
    throw new ApiError('NOT_FOUND')
  }

  return NextResponse.json({ project })
})

export const PATCH = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult
  const { id } = await context.params

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project || project.userId !== session.user.id) {
    throw new ApiError('NOT_FOUND')
  }

  const body = await request.json().catch(() => ({}))
  const { name, currentStep, coverImageUrl, state } = body as {
    name?: string
    currentStep?: string
    coverImageUrl?: string | null
    state?: unknown
  }

  const data: Prisma.ProjectUpdateInput = {}
  if (typeof name === 'string') {
    if (!name.trim()) throw new ApiError('BAD_REQUEST', '项目名称不能为空')
    data.name = name.trim()
  }
  if (typeof currentStep === 'string') data.currentStep = currentStep
  if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl
  if (state !== undefined) {
    data.state = (state === null
      ? Prisma.DbNull
      : (state as Prisma.InputJsonValue))
  }

  const updated = await prisma.project.update({
    where: { id },
    data,
  })

  return NextResponse.json({ project: updated })
})

export const DELETE = apiHandler(async (
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult
  const { id } = await context.params

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project || project.userId !== session.user.id) {
    throw new ApiError('NOT_FOUND')
  }

  await prisma.project.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
