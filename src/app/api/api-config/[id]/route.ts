import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { encryptApiKey } from '@/lib/crypto-utils'

function maskApiKey(encrypted: string): string {
  if (!encrypted || encrypted.length < 8) return '••••••••'
  const parts = encrypted.split(':')
  if (parts.length === 3) {
    return `sk-•••${parts[2].slice(-4)}`
  }
  return `••••${encrypted.slice(-4)}`
}

export const PUT = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult
  const { id } = await context.params

  const existing = await prisma.apiConfig.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    throw new ApiError('NOT_FOUND')
  }

  const body = await request.json()
  const { category, name, baseUrl, apiKey, modelName, isDefault } = body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {}

  if (name !== undefined) updateData.name = name
  if (baseUrl !== undefined) updateData.baseUrl = baseUrl
  if (modelName !== undefined) updateData.modelName = modelName
  if (category !== undefined) {
    if (!['llm', 'image', 'video'].includes(category)) {
      throw new ApiError('BAD_REQUEST', '类别必须是 llm、image 或 video')
    }
    updateData.category = category
  }

  if (apiKey !== undefined && apiKey.trim() !== '') {
    updateData.apiKey = encryptApiKey(apiKey)
  }

  if (isDefault !== undefined) {
    updateData.isDefault = isDefault
    if (isDefault) {
      const cat = category ?? existing.category
      await prisma.apiConfig.updateMany({
        where: { userId: session.user.id, category: cat, id: { not: id } },
        data: { isDefault: false },
      })
    }
  }

  const config = await prisma.apiConfig.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json({
    config: {
      id: config.id,
      category: config.category,
      name: config.name,
      baseUrl: config.baseUrl,
      modelName: config.modelName,
      isDefault: config.isDefault,
      apiKeyMasked: maskApiKey(config.apiKey),
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

  const config = await prisma.apiConfig.findUnique({ where: { id } })
  if (!config || config.userId !== session.user.id) {
    throw new ApiError('NOT_FOUND')
  }

  await prisma.apiConfig.delete({ where: { id } })

  return NextResponse.json({ success: true })
})
