/**
 * BA Auth - Auto-acquire ByteArtist cookie via Chrome DevTools Protocol
 *
 * Ported from ba_cookie/scripts/ba_auth.js to TypeScript module.
 *
 * Strategy:
 * 1. Try connecting to an already-running Chrome/Edge via its remote debugging port.
 * 2. If none found, launch headless Edge with a persistent profile so cookies
 *    from a previous manual login session are available, then read via CDP.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import http from 'http'
import net from 'net'
import { spawn, execSync, type ChildProcess } from 'child_process'
import WebSocket from 'ws'

const DEFAULT_DEBUG_PORT = 9222
const LOGIN_DEBUG_PORT = 9234
const BENCH_HOST = 'byteartist-workbench.bytedance.net'
const PROFILE_DIR = path.join(os.homedir(), '.ba-auth-profile')

const CHROME_BIN =
  process.env.CHROME_BIN ||
  (process.platform === 'win32'
    ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '/usr/bin/chromium-browser')

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

function domainMatches(host: string, domain: string): boolean {
  const normalized = domain.startsWith('.') ? domain.slice(1) : domain
  return host === normalized || host.endsWith(`.${normalized}`)
}

// ---------------------------------------------------------------------------
// HTTP / network helpers
// ---------------------------------------------------------------------------

function requestJson(url: string, method = 'GET'): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = http.request(
      { host: u.hostname, port: u.port || 80, path: `${u.pathname}${u.search}`, method },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch { reject(new Error(`JSON parse error from ${url}: ${data.slice(0, 300)}`)) }
        })
      },
    )
    req.on('error', reject)
    req.end()
  })
}

async function waitForEndpoint(url: string, timeoutMs = 10000): Promise<Record<string, unknown>> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try { return await requestJson(url) }
    catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address() as net.AddressInfo
      s.close(() => resolve(addr.port))
    })
    s.on('error', reject)
  })
}

function findChromeDebugPort(): number | null {
  if (process.platform !== 'win32') return null
  try {
    const out = execSync(
      'wmic process where "name=\'msedge.exe\' or name=\'chrome.exe\'" get commandline 2>nul',
      { encoding: 'utf-8', timeout: 8000 },
    )
    const match = out.match(/--remote-debugging-port=(\d+)/)
    return match ? parseInt(match[1], 10) : null
  } catch { return null }
}

// ---------------------------------------------------------------------------
// CDP cookie extraction
// ---------------------------------------------------------------------------

interface CDPCookie {
  name: string
  value: string
  domain: string
  expires: number
}

async function getCookiesOverWs(wsUrl: string, benchHost: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const callbacks = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('CDP WebSocket timeout'))
    }, 15000)

    ws.on('message', (raw: WebSocket.RawData) => {
      const msg = JSON.parse(raw.toString())
      if (msg.id && callbacks.has(msg.id)) {
        const cb = callbacks.get(msg.id)!
        callbacks.delete(msg.id)
        if (msg.error) cb.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
        else cb.resolve(msg.result)
      }
    })

    ws.on('open', async () => {
      const send = (method: string, params: Record<string, unknown> = {}): Promise<unknown> =>
        new Promise((res, rej) => {
          const cid = ++id
          callbacks.set(cid, { resolve: res, reject: rej })
          ws.send(JSON.stringify({ id: cid, method, params }))
        })

      try {
        await send('Network.enable')
        await new Promise((r) => setTimeout(r, 2000))

        const result = (await send('Network.getAllCookies')) as { cookies: CDPCookie[] }
        ws.close()
        clearTimeout(timeout)

        const now = Date.now() / 1000
        const cookies = result.cookies
          .filter((c) => {
            if (!domainMatches(benchHost, c.domain)) return false
            if (c.expires && c.expires > 0 && c.expires < now) return false
            return true
          })
          .map((c) => `${c.name}=${c.value}`)

        resolve(cookies)
      } catch (err) {
        ws.close()
        clearTimeout(timeout)
        reject(err)
      }
    })

    ws.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

// ---------------------------------------------------------------------------
// Browser launching
// ---------------------------------------------------------------------------

function cleanSingletonLocks(dir: string) {
  for (const lockFile of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    try { fs.unlinkSync(path.join(dir, lockFile)) } catch { /* ignore */ }
  }
}

/**
 * Kill Edge/Chrome processes that use our dedicated profile directory.
 * On Windows, uses wmic to find processes whose command line contains the profile path.
 */
async function killProfileBrowsers(): Promise<void> {
  if (process.platform !== 'win32') return
  try {
    const profileEscaped = PROFILE_DIR.replace(/\\/g, '\\\\')
    execSync(
      `wmic process where "commandline like '%${profileEscaped}%' and (name='msedge.exe' or name='chrome.exe')" call terminate 2>nul`,
      { encoding: 'utf-8', timeout: 8000 },
    )
    await new Promise((r) => setTimeout(r, 1500))
  } catch { /* no matching processes or wmic error, safe to ignore */ }
}

interface CDPTarget {
  type: string
  webSocketDebuggerUrl?: string
}

async function tryExistingBrowser(
  debugPort: number,
  benchHost: string,
  benchBaseUrl: string,
): Promise<string[]> {
  const targets = (await requestJson(`http://127.0.0.1:${debugPort}/json`)) as unknown as CDPTarget[]
  let target = Array.isArray(targets) ? targets.find((t) => t.type === 'page') : undefined
  if (!target) {
    target = (await requestJson(
      `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(benchBaseUrl)}`,
      'PUT',
    )) as unknown as CDPTarget
  }
  if (!target?.webSocketDebuggerUrl) throw new Error('No WS URL for page target')
  return getCookiesOverWs(target.webSocketDebuggerUrl, benchHost)
}

async function launchHeadless(benchHost: string, benchBaseUrl: string): Promise<string> {
  if (!fs.existsSync(CHROME_BIN)) {
    throw new Error(`Browser not found at ${CHROME_BIN}. Set CHROME_BIN env var.`)
  }

  // Kill any existing browser using our profile dir to avoid lock conflicts
  await killProfileBrowsers()

  const debugPort = await getFreePort()
  fs.mkdirSync(PROFILE_DIR, { recursive: true })
  cleanSingletonLocks(PROFILE_DIR)

  console.log(`[ba-auth] Launching headless browser on port ${debugPort}`)

  const isDocker = process.env.NODE_ENV === 'production' && process.platform === 'linux'
  const chrome = spawn(CHROME_BIN, [
    `--remote-debugging-port=${debugPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${PROFILE_DIR}`,
    '--profile-directory=Default',
    ...(isDocker ? ['--no-sandbox', '--disable-dev-shm-usage', '--disable-setuid-sandbox'] : []),
    benchBaseUrl,
  ], { stdio: ['ignore', 'pipe', 'pipe'] })

  chrome.stderr?.on('data', (d: Buffer) => {
    const s = d.toString().trim()
    if (s && !s.includes('DEPRECATED') && !s.includes('TensorFlow') && !s.includes('sandbox')) {
      console.error(`[ba-auth browser stderr] ${s.slice(0, 300)}`)
    }
  })
  chrome.on('error', (e) => console.error('[ba-auth browser spawn error]', e))
  chrome.on('exit', (code) => console.log(`[ba-auth] Browser exited with code ${code}`))

  try {
    await waitForEndpoint(`http://127.0.0.1:${debugPort}/json/version`, 30000)
    const cookies = await tryExistingBrowser(debugPort, benchHost, benchBaseUrl)
    if (!cookies.length) {
      throw new Error(
        `No cookies found for ${benchHost}. Please run "首次登录" first to cache your login session.`,
      )
    }
    return cookies.join('; ')
  } finally {
    chrome.kill('SIGTERM')
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Acquire cookie in headless mode.
 * Tries connecting to an already-running browser first, then launches a fresh headless instance.
 */
export async function acquireCookie(benchBaseUrl: string): Promise<string> {
  const benchHost = new URL(benchBaseUrl).hostname

  // Include the login debug port first (most likely to have cookies)
  const portsToTry = [LOGIN_DEBUG_PORT, DEFAULT_DEBUG_PORT, ...Array.from({ length: 10 }, (_, i) => DEFAULT_DEBUG_PORT + 1 + i)]
  const wmicPort = findChromeDebugPort()
  if (wmicPort && !portsToTry.includes(wmicPort)) portsToTry.unshift(wmicPort)

  for (const port of portsToTry) {
    try {
      const version = await requestJson(`http://127.0.0.1:${port}/json/version`) as { 'User-Agent'?: string }
      if (version?.['User-Agent']?.includes('Chrome') || version?.['User-Agent']?.includes('Edg')) {
        console.log(`[ba-auth] Found running browser on port ${port}, reading cookies...`)
        const cookies = await tryExistingBrowser(port, benchHost, benchBaseUrl)
        if (cookies.length) {
          console.log(`[ba-auth] Got ${cookies.length} cookies from port ${port}`)
          return cookies.join('; ')
        }
      }
    } catch { /* next port */ }
  }

  console.log('[ba-auth] No running browser found with cookies, launching headless...')
  return launchHeadless(benchHost, benchBaseUrl)
}

/**
 * Open a visible browser window for the user to manually log in.
 * Includes a remote debugging port so acquireCookie can read cookies
 * directly from this running instance without needing to relaunch.
 * The user should close the browser when done; cookies are cached in the profile dir.
 */
export async function openLoginBrowser(benchBaseUrl: string): Promise<ChildProcess> {
  if (!fs.existsSync(CHROME_BIN)) {
    throw new Error(`Browser not found at ${CHROME_BIN}. Set CHROME_BIN env var.`)
  }

  // Kill any existing browser using our profile dir first
  await killProfileBrowsers()

  fs.mkdirSync(PROFILE_DIR, { recursive: true })
  cleanSingletonLocks(PROFILE_DIR)

  const chrome = spawn(CHROME_BIN, [
    `--remote-debugging-port=${LOGIN_DEBUG_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--profile-directory=Default',
    benchBaseUrl,
  ], { stdio: 'ignore', detached: true })

  chrome.unref()
  return chrome
}
