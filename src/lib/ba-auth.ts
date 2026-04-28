/**
 * BA Auth - helpers for ByteArtist room authentication.
 *
 * Cookie acquisition is handled client-side:
 * users log in to ByteArtist in their own browser and paste the Cookie header
 * value from DevTools → Network → Request Headers into the settings page.
 */

const BENCH_HOST = 'byteartist-workbench.bytedance.net'

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

export function resolveBenchBaseUrl(roomUrl: string): string {
  const url = new URL(roomUrl)
  if (url.hostname.includes(BENCH_HOST)) return `${url.protocol}//${url.hostname}`
  const match = url.pathname.match(/\/room\/(bench-[^/?]+)/)
  if (!match) throw new Error(`Could not parse bench id from URL: ${roomUrl}`)
  return `https://${match[1]}.${BENCH_HOST}`
}

// ---------------------------------------------------------------------------
// Cookie validation
// ---------------------------------------------------------------------------

export function validateCookieFormat(cookie: unknown): asserts cookie is string {
  if (!cookie || typeof cookie !== 'string') {
    throw new Error('Cookie 不能为空')
  }
  if (cookie.includes('\n') || cookie.includes('\r')) {
    throw new Error('Cookie 格式错误：不能包含换行符')
  }
  if (!cookie.includes('=')) {
    throw new Error('Cookie 格式错误：应为 key=value; key2=value2 格式')
  }
  if (cookie.trim().length < 10) {
    throw new Error('Cookie 内容过短，请确认复制完整')
  }
}
