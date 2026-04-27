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

export const GET = apiHandler(async () => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const configs = await prisma.apiConfig.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  const masked = configs.map((c) => ({
    id: c.id,
    category: c.category,
    name: c.name,
    baseUrl: c.baseUrl,
    modelName: c.modelName,
    isDefault: c.isDefault,
    apiKeyMasked: maskApiKey(c.apiKey),
    createdAt: c.createdAt,
  }))

  return NextResponse.json({ configs: masked })
})

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json()
  const { category, name, baseUrl, apiKey, modelName, isDefault } = body

  if (!category || !name || !baseUrl || !apiKey || !modelName) {
    throw new ApiError('BAD_REQUEST', '所有字段均为必填')
  }

  if (!['llm', 'image', 'video'].includes(category)) {
    throw new ApiError('BAD_REQUEST', '类别必须是 llm、image 或 video')
  }

  const encryptedKey = encryptApiKey(apiKey)

  if (isDefault) {
    await prisma.apiConfig.updateMany({
      where: { userId: session.user.id, category },
      data: { isDefault: false },
    })
  }

  const config = await prisma.apiConfig.create({
    data: {
      userId: session.user.id,
      category,
      name,
      baseUrl,
      apiKey: encryptedKey,
      modelName,
      isDefault: isDefault ?? false,
    },
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
  }, { status: 201 })
})
