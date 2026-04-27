import OpenAI from 'openai'
import { prisma } from './prisma'
import { decryptApiKey } from './crypto-utils'

function formatLLMError(err: unknown, baseUrl: string): string {
  if (err instanceof OpenAI.APIConnectionError) {
    return `无法连接到 ${baseUrl}。请在「设置」页检查 Base URL 是否正确（注意 /v1 后缀），以及网络是否可达。`
  }
  if (err instanceof OpenAI.AuthenticationError) {
    return `API Key 认证失败（401）。请在「设置」页检查 API Key 是否正确。`
  }
  if (err instanceof OpenAI.PermissionDeniedError) {
    return `权限不足（403）。API Key 可能没有访问该模型的权限。`
  }
  if (err instanceof OpenAI.NotFoundError) {
    return `模型或接口不存在（404）。请检查 Base URL 路径和模型名称是否正确。(${baseUrl})`
  }
  if (err instanceof OpenAI.RateLimitError) {
    return `触发速率限制（429）。请稍后重试。`
  }
  if (err instanceof OpenAI.APIError) {
    return `API 返回错误 (${err.status}): ${err.message}`
  }
  if (err instanceof Error) {
    if (err.message.includes('ECONNREFUSED')) {
      return `连接被拒绝 (${baseUrl})。目标服务器可能未运行或端口不正确。`
    }
    if (err.message.includes('ENOTFOUND')) {
      return `DNS 解析失败 (${baseUrl})。域名可能不存在或网络不通。`
    }
    if (err.message.includes('ETIMEDOUT') || err.message.includes('timeout')) {
      return `连接超时 (${baseUrl})。服务器无响应或网络延迟过高。`
    }
    return `LLM 调用失败: ${err.message}`
  }
  return `LLM 调用失败: ${String(err)}`
}

export async function callUserLLM(
  userId: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
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
    throw new Error('LLM API Key 解密失败，请重新在「设置」页保存 API Key')
  }

  const client = new OpenAI({
    baseURL: config.baseUrl,
    apiKey,
    timeout: 120000,
  })

  try {
    const completion = await client.chat.completions.create({
      model: config.modelName,
      messages,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('LLM 返回了空内容')
    }

    return content
  } catch (err) {
    throw new Error(formatLLMError(err, config.baseUrl))
  }
}
