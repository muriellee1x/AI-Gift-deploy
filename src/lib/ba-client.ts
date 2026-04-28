/**
 * BA Client - HTTP client for ByteArtist room (ComfyUI) APIs.
 * All requests carry a cookie header obtained via ba-auth.
 */

interface FetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: BodyInit | null
}

async function baFetch(
  benchBaseUrl: string,
  cookie: string,
  endpoint: string,
  options: FetchOptions = {},
): Promise<Response> {
  const url = `${benchBaseUrl.replace(/\/+$/, '')}${endpoint}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Cookie: cookie,
      ...options.headers,
    },
  })
  return res
}

// ---------------------------------------------------------------------------
// System / Queue
// ---------------------------------------------------------------------------

export interface SystemStats {
  system: Record<string, unknown>
  devices: Record<string, unknown>[]
  [key: string]: unknown
}

export class BaCookieInvalidError extends Error {
  constructor(message = 'Cookie 已失效，请到设置页刷新') {
    super(message)
    this.name = 'BaCookieInvalidError'
  }
}

export function isCookieInvalidStatus(status: number): boolean {
  return status === 401 || status === 403
}

export async function testConnection(
  benchBaseUrl: string,
  cookie: string,
): Promise<{ ok: boolean; message: string; data?: SystemStats }> {
  try {
    const res = await baFetch(benchBaseUrl, cookie, '/system_stats')
    if (isCookieInvalidStatus(res.status)) {
      return { ok: false, message: `HTTP ${res.status}: Cookie 无效或已过期，请刷新 Cookie` }
    }
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}: ${res.statusText}` }
    }
    const data = (await res.json()) as SystemStats
    return { ok: true, message: '连接成功', data }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

export async function getQueue(
  benchBaseUrl: string,
  cookie: string,
): Promise<Record<string, unknown>> {
  const res = await baFetch(benchBaseUrl, cookie, '/queue')
  if (isCookieInvalidStatus(res.status)) throw new BaCookieInvalidError()
  if (!res.ok) throw new Error(`GET /queue failed: ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

export async function getObjectInfo(
  benchBaseUrl: string,
  cookie: string,
): Promise<Record<string, unknown>> {
  const res = await baFetch(benchBaseUrl, cookie, '/object_info')
  if (isCookieInvalidStatus(res.status)) throw new BaCookieInvalidError()
  if (!res.ok) throw new Error(`GET /object_info failed: ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

// ---------------------------------------------------------------------------
// Prompt / Workflow
// ---------------------------------------------------------------------------

export interface PromptResponse {
  prompt_id: string
  number: number
  node_errors: Record<string, unknown>
}

export async function submitPrompt(
  benchBaseUrl: string,
  cookie: string,
  workflow: Record<string, unknown>,
): Promise<PromptResponse> {
  const res = await baFetch(benchBaseUrl, cookie, '/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  })
  if (isCookieInvalidStatus(res.status)) throw new BaCookieInvalidError()
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST /prompt failed (${res.status}): ${text.slice(0, 500)}`)
  }
  return res.json() as Promise<PromptResponse>
}

// ---------------------------------------------------------------------------
// History / Results
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  status: { status_str: string; completed: boolean; messages?: Array<{ type: string; message: string; details?: string; [k: string]: unknown }> }
  outputs: Record<string, {
    images?: { filename: string; subfolder: string; type: string }[]
    videos?: { filename: string; subfolder: string; type: string }[]
    gifs?: { filename: string; subfolder: string; type: string }[]
  }>
  [key: string]: unknown
}

export async function getHistory(
  benchBaseUrl: string,
  cookie: string,
  promptId: string,
): Promise<Record<string, HistoryEntry>> {
  const res = await baFetch(benchBaseUrl, cookie, `/history/${promptId}`)
  if (isCookieInvalidStatus(res.status)) throw new BaCookieInvalidError()
  if (!res.ok) throw new Error(`GET /history/${promptId} failed: ${res.status}`)
  return res.json() as Promise<Record<string, HistoryEntry>>
}

// ---------------------------------------------------------------------------
// Upload / Download
// ---------------------------------------------------------------------------

export async function uploadImage(
  benchBaseUrl: string,
  cookie: string,
  fileBuffer: Buffer,
  filename: string,
): Promise<Record<string, unknown>> {
  const formData = new FormData()
  formData.append('image', new Blob([new Uint8Array(fileBuffer)]), filename)

  const res = await baFetch(benchBaseUrl, cookie, '/upload/image', {
    method: 'POST',
    body: formData,
  })
  if (isCookieInvalidStatus(res.status)) throw new BaCookieInvalidError()
  if (!res.ok) throw new Error(`POST /upload/image failed: ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

export async function uploadVideo(
  benchBaseUrl: string,
  cookie: string,
  fileBuffer: Buffer,
  filename: string,
): Promise<Record<string, unknown>> {
  const formData = new FormData()
  formData.append('image', new Blob([new Uint8Array(fileBuffer)], { type: 'video/mp4' }), filename)

  const res = await baFetch(benchBaseUrl, cookie, '/upload/image', {
    method: 'POST',
    body: formData,
  })
  if (isCookieInvalidStatus(res.status)) throw new BaCookieInvalidError()
  if (!res.ok) throw new Error(`POST /upload/image(video) failed: ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

export async function downloadOutput(
  benchBaseUrl: string,
  cookie: string,
  filename: string,
  subfolder = '',
  type = 'output',
): Promise<Buffer> {
  const params = new URLSearchParams({ filename, subfolder, type })
  const res = await baFetch(benchBaseUrl, cookie, `/view?${params}`)
  if (isCookieInvalidStatus(res.status)) throw new BaCookieInvalidError()
  if (!res.ok) throw new Error(`GET /view failed: ${res.status}`)
  const arrayBuf = await res.arrayBuffer()
  return Buffer.from(arrayBuf)
}
