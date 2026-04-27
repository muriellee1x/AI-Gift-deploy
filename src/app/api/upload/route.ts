import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { uploadObject, generateUniqueKey } from '@/lib/storage'
import { compressImage } from '@/lib/image-utils'

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer())
  const compressed = await compressImage(rawBuffer)

  const key = generateUniqueKey('upload', 'png')
  const storageKey = await uploadObject(compressed, key, 3, 'image/png')
  const imageUrl = `/api/files/${encodeURIComponent(storageKey)}`

  return NextResponse.json({ imageUrl, storageKey })
})
