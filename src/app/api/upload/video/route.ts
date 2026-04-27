import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { uploadObject, generateUniqueKey } from '@/lib/storage'

const MAX_SIZE = 100 * 1024 * 1024 // 100 MB

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) throw new ApiError('BAD_REQUEST', 'file is required')

  if (!file.type.includes('mp4') && !file.name.toLowerCase().endsWith('.mp4')) {
    throw new ApiError('BAD_REQUEST', '仅支持 MP4 格式视频')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_SIZE) {
    throw new ApiError('BAD_REQUEST', `视频文件不能超过 ${MAX_SIZE / 1024 / 1024}MB`)
  }

  const key = generateUniqueKey('upload/video', 'mp4')
  const storageKey = await uploadObject(buffer, key, 3, 'video/mp4')
  const videoUrl = `/api/files/${encodeURIComponent(storageKey)}`

  return NextResponse.json({ videoUrl, storageKey })
})
