/**
 * Video generation API client for Seedance 2.0 (Volcano Engine / Ark)
 *
 * Async task model:
 *   1. POST /contents/generations/tasks  -> task_id
 *   2. GET  /contents/generations/tasks/{id}  -> poll until succeeded/failed
 *   3. Download video from content.video_url -> upload to MinIO
 */

import { prisma } from './prisma'
import { decryptApiKey } from './crypto-utils'
import {
  uploadObject,
  generateUniqueKey,
  extractStorageKey,
  getObjectBuffer,
  getSignedObjectUrl,
  getStorageProvider,
} from './storage'

export type VideoGenerationResult = {
  videoUrl: string
  storageKey: string
}

const POLL_INTERVAL_MS = 5_000
const POLL_MAX_WAIT_MS = 10 * 60 * 1000 // 10 minutes

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// Content item builders
// ---------------------------------------------------------------------------

type ContentItem =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string }; role: 'reference_image' }
  | { type: 'video_url'; video_url: { url: string }; role: 'reference_video' }

function buildContentArray(
  prompt: string,
  referenceImageUrls?: string[],
  referenceVideoUrl?: string | null,
): ContentItem[] {
  const items: ContentItem[] = [{ type: 'text', text: prompt }]

  if (referenceImageUrls) {
    for (const url of referenceImageUrls) {
      if (url) {
        items.push({
          type: 'image_url',
          image_url: { url },
          role: 'reference_image',
        })
      }
    }
  }

  if (referenceVideoUrl) {
    items.push({
      type: 'video_url',
      video_url: { url: referenceVideoUrl },
      role: 'reference_video',
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// Resolve local /api/files/xxx URLs to presigned URLs
// ---------------------------------------------------------------------------

function mimeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  return 'image/png'
}

async function resolveImageUrl(url: string): Promise<string | null> {
  if (!url) return null

  if (url.startsWith('http://') || url.startsWith('https://')) return url

  // For local storage paths, download the image and convert to base64 data URL
  // because presigned MinIO URLs point to localhost which remote APIs cannot access.
  let storageKey: string | null = null

  if (url.startsWith('/api/files/')) {
    storageKey = decodeURIComponent(url.replace('/api/files/', ''))
  } else {
    storageKey = extractStorageKey(url)
  }

  if (!storageKey) return null

  try {
    const buffer = await getObjectBuffer(storageKey)
    const mime = mimeFromKey(storageKey)
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch (err) {
    console.warn(`[video-call] Failed to read object for key ${storageKey}:`, err)
    return null
  }
}

async function resolveVideoUrl(url: string): Promise<string | null> {
  if (!url) return null

  if (url.startsWith('http://') || url.startsWith('https://')) return url

  // Seedance's reference_video role requires a real HTTP URL; base64 data URLs
  // are rejected with "reference_video must be provided as a web url".
  // We therefore return a presigned object storage URL. This means the storage
  // provider (MinIO / COS) must be reachable from the remote video API: running
  // MinIO only on localhost in dev will NOT work.
  let storageKey: string | null = null

  if (url.startsWith('/api/files/')) {
    storageKey = decodeURIComponent(url.replace('/api/files/', ''))
  } else {
    storageKey = extractStorageKey(url)
  }

  if (!storageKey) return null

  const provider = getStorageProvider()
  if (provider.kind === 'local') {
    console.warn(
      `[video-call] Storage provider is "local"; video reference cannot be fetched by Seedance. ` +
        `Configure MinIO/COS with a public endpoint for video reference.`,
    )
    return null
  }

  try {
    const signed = await getSignedObjectUrl(storageKey)
    if (/^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)/i.test(signed)) {
      console.warn(
        `[video-call] Signed video URL points to localhost (${signed.slice(0, 80)}...). ` +
          `Seedance will not be able to fetch it; set a public endpoint for MinIO/COS.`,
      )
    }
    return signed
  } catch (err) {
    console.warn(`[video-call] Failed to sign video URL for key ${storageKey}:`, err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Seedance API interaction
// ---------------------------------------------------------------------------

interface SeedanceTaskResponse {
  id: string
  model: string
  status: string
  content?: {
    video_url?: string
  }
  error?: {
    code: string
    message: string
  }
}

const TASKS_PATH = '/contents/generations/tasks'

function resolveTasksUrl(baseUrl: string): string {
  const cleaned = baseUrl.replace(/\/+$/, '')
  if (cleaned.endsWith(TASKS_PATH)) return cleaned
  if (cleaned.endsWith('/contents/generations')) return `${cleaned}/tasks`
  return `${cleaned}${TASKS_PATH}`
}

async function submitTask(
  baseUrl: string,
  apiKey: string,
  model: string,
  content: ContentItem[],
  options: { ratio: string; duration: number },
): Promise<string> {
  const url = resolveTasksUrl(baseUrl)

  const requestBody = {
    model,
    content,
    ratio: options.ratio,
    duration: options.duration,
    watermark: false,
  }

  console.log(`[video-call] submitTask to ${url} | model=${model} | content_items=${content.length} | ratio=${options.ratio} | duration=${options.duration}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`视频任务提交失败 (${res.status}): ${text.slice(0, 500)}`)
  }

  const data = (await res.json()) as SeedanceTaskResponse
  if (!data.id) {
    throw new Error(`视频任务提交返回异常: ${JSON.stringify(data).slice(0, 500)}`)
  }

  console.log(`[video-call] Task submitted: ${data.id}`)
  return data.id
}

async function pollTask(
  baseUrl: string,
  apiKey: string,
  taskId: string,
  onProgress?: (status: string) => void,
): Promise<string> {
  const url = `${resolveTasksUrl(baseUrl)}/${taskId}`
  const start = Date.now()

  while (Date.now() - start < POLL_MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS)

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`视频任务查询失败 (${res.status}): ${text.slice(0, 300)}`)
    }

    const data = (await res.json()) as SeedanceTaskResponse
    const status = data.status

    if (onProgress) onProgress(status)

    if (status === 'succeeded') {
      const videoUrl = data.content?.video_url
      if (!videoUrl) throw new Error('视频生成成功但未返回 video_url')
      console.log(`[video-call] Task ${taskId} succeeded`)
      return videoUrl
    }

    if (status === 'failed') {
      const errMsg = data.error?.message || '未知错误'
      throw new Error(`视频生成失败: ${errMsg}`)
    }

    // queued / running -> continue polling
    console.log(`[video-call] Task ${taskId} status: ${status}`)
  }

  throw new Error(`视频生成超时（已等待 ${Math.round(POLL_MAX_WAIT_MS / 60000)} 分钟）`)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function callUserVideoAPI(
  userId: string,
  prompt: string,
  options?: {
    referenceImageUrls?: string[]
    referenceVideoUrl?: string
    ratio?: string
    duration?: number
    onProgress?: (status: string) => void
  },
): Promise<VideoGenerationResult> {
  const config = await prisma.apiConfig.findFirst({
    where: { userId, category: 'video', isDefault: true },
  })

  if (!config) {
    throw new Error('请先在「设置」页配置默认的视频生成 API（类别选择"视频生成模型"并设为默认）')
  }

  let apiKey: string
  try {
    apiKey = decryptApiKey(config.apiKey)
  } catch {
    throw new Error('视频 API Key 解密失败，请重新在设置页保存')
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  // Resolve local image URLs to presigned URLs
  const resolvedUrls: string[] = []
  if (options?.referenceImageUrls) {
    console.log(`[video-call] Raw reference URLs (${options.referenceImageUrls.length}):`, options.referenceImageUrls)
    for (const rawUrl of options.referenceImageUrls) {
      const resolved = await resolveImageUrl(rawUrl)
      if (resolved) {
        resolvedUrls.push(resolved)
      } else {
        console.warn(`[video-call] Failed to resolve image URL: ${rawUrl}`)
      }
    }
    console.log(`[video-call] Resolved reference URLs (${resolvedUrls.length}):`, resolvedUrls.map((u) => u.startsWith('data:') ? `${u.slice(0, 30)}...(base64 ${Math.round(u.length / 1024)}KB)` : u.slice(0, 120)))
  }

  let resolvedVideoUrl: string | null = null
  if (options?.referenceVideoUrl) {
    resolvedVideoUrl = await resolveVideoUrl(options.referenceVideoUrl)
    if (!resolvedVideoUrl) {
      console.warn(`[video-call] Failed to resolve video URL: ${options.referenceVideoUrl}`)
    }
  }

  const content = buildContentArray(
    prompt,
    resolvedUrls.length > 0 ? resolvedUrls : undefined,
    resolvedVideoUrl,
  )
  console.log(
    `[video-call] Content array has ${content.length} items (text:${content.filter((c) => c.type === 'text').length}, image:${content.filter((c) => c.type === 'image_url').length}, video:${content.filter((c) => c.type === 'video_url').length})`,
  )

  // Step 1: Submit task
  const taskId = await submitTask(
    baseUrl,
    apiKey,
    config.modelName,
    content,
    {
      ratio: options?.ratio || '16:9',
      duration: options?.duration || 5,
    },
  )

  // Step 2: Poll until complete
  const remoteVideoUrl = await pollTask(baseUrl, apiKey, taskId, options?.onProgress)

  // Step 3: Download video and upload to MinIO
  const videoBuffer = await downloadVideo(remoteVideoUrl, apiKey)
  const key = generateUniqueKey('video', 'mp4')
  const storageKey = await uploadObject(videoBuffer, key, 3, 'video/mp4')

  return {
    videoUrl: `/api/files/${encodeURIComponent(storageKey)}`,
    storageKey,
  }
}

async function downloadVideo(videoUrl: string, apiKey: string): Promise<Buffer> {
  const res = await fetch(videoUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': 'Mozilla/5.0 (compatible; VideoDownloader/1.0)',
    },
  })

  if (!res.ok) {
    // Retry without auth header in case it's a direct CDN link
    const res2 = await fetch(videoUrl)
    if (!res2.ok) {
      throw new Error(`视频下载失败 (${res2.status})`)
    }
    return Buffer.from(await res2.arrayBuffer())
  }

  return Buffer.from(await res.arrayBuffer())
}
