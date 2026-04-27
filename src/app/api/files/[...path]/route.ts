import { NextRequest, NextResponse } from 'next/server'
import { getStorageProvider } from '@/lib/storage'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: segments } = await context.params
    const key = segments.map(decodeURIComponent).join('/')

    if (!key) {
      return NextResponse.json({ error: 'Missing file path' }, { status: 400 })
    }

    const provider = getStorageProvider()
    const buffer = await provider.getObjectBuffer(key)

    let contentType = 'application/octet-stream'
    if (key.endsWith('.png')) contentType = 'image/png'
    else if (key.endsWith('.jpg') || key.endsWith('.jpeg')) contentType = 'image/jpeg'
    else if (key.endsWith('.webp')) contentType = 'image/webp'
    else if (key.endsWith('.mp4')) contentType = 'video/mp4'
    else if (key.endsWith('.webm')) contentType = 'video/webm'

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const lower = message.toLowerCase()
    const missing = lower.includes('nosuchkey')
      || lower.includes('notfound')
      || lower.includes('not found')
      || lower.includes('404')

    if (missing) {
      console.warn(`[Files API] missing object: ${key}`)
    } else {
      console.error(`[Files API] Error for key ${key}:`, err)
    }
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
