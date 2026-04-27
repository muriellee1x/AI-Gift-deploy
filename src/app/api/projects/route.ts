import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'

const VALID_KINDS = new Set(['superpower', 'vertical', 'general', 'postprocess'])

export const GET = apiHandler(async () => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      kind: true,
      subKind: true,
      currentStep: true,
      coverImageUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ projects })
})

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json().catch(() => ({}))
  const {
    name,
    kind,
    subKind,
    currentStep,
    coverImageUrl,
    state,
  } = body as {
    name?: string
    kind?: string
    subKind?: string
    currentStep?: string
    coverImageUrl?: string | null
    state?: unknown
  }

  if (!kind || !VALID_KINDS.has(kind)) {
    throw new ApiError('BAD_REQUEST', `kind must be one of: ${[...VALID_KINDS].join(', ')}`)
  }
  if (!subKind || typeof subKind !== 'string' || !subKind.trim()) {
    throw new ApiError('BAD_REQUEST', 'subKind is required')
  }

  const projectName = (typeof name === 'string' && name.trim())
    ? name.trim()
    : 'Untitled'

  const project = await prisma.project.create({
    data: {
      userId: session.user.id,
      name: projectName,
      kind,
      subKind: subKind.trim(),
      currentStep: currentStep || 'step1',
      coverImageUrl: coverImageUrl || null,
      state: (state as object | undefined) ?? undefined,
    },
  })

  return NextResponse.json({ project }, { status: 201 })
})
