/**
 * Multimodal LLM call - supports video/image + text input via OpenAI-compatible API.
 * Uses direct fetch to /v1/chat/completions to avoid OpenAI SDK v6+ auto-routing
 * to the Responses API endpoint, which causes URL construction issues with some providers.
 */

import { prisma } from './prisma'
import { decryptApiKey } from './crypto-utils'

type TextPart = { type: 'text'; text: string }
type ImageUrlPart = { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
export type ContentPart = TextPart | ImageUrlPart

function buildChatCompletionsUrl(baseUrl: string): string {
  let base = baseUrl.replace(/\/+$/, '')
  base = base.replace(/\/(chat\/completions|responses|completions)$/, '')
  return `${base}/chat/completions`
}

export async function callUserMultimodalLLM(
  userId: string,
  contentParts: ContentPart[],
): Promise<string> {
  const config = await prisma.apiConfig.findFirst({
    where: { userId, category: 'llm', isDefault: true },
  })

  if (!config) {
    throw new Error('请先在「设置」页配置默认的 LLM API（类别选择 LLM 文本模型，并设为默认）')
  }

  let apiKey: string
  try {
    apiKey = decryptApiKey(config.apiKey)
  } catch {
    throw new Error('LLM API Key 解密失败，请重新在「设置」页保存')
  }

  const url = buildChatCompletionsUrl(config.baseUrl)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [{ role: 'user', content: contentParts }],
      }),
      signal: AbortSignal.timeout(300000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      if (res.status === 401) throw new Error('API Key 认证失败（401）。')
      if (res.status === 403) throw new Error('权限不足（403）。API Key 可能没有访问该模型的权限。')
      if (res.status === 404) throw new Error(`模型或接口不存在（404）。请检查模型名称。(${url})`)
      if (res.status === 429) throw new Error('触发速率限制（429）。请稍后重试。')
      throw new Error(`API 返回错误 (${res.status}): ${body.slice(0, 500)}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('LLM 返回了空内容')
    return content
  } catch (err) {
    if (err instanceof TypeError && (err as Error).message === 'fetch failed') {
      throw new Error(`无法连接到 ${url}。请检查 Base URL 和网络连接。`)
    }
    if (err instanceof Error && err.message.includes('timed out')) {
      throw new Error(`请求超时（5分钟）。视频较大时 LLM 处理可能较慢，请稍后重试。`)
    }
    throw err
  }
}
