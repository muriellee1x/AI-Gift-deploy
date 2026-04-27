import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'

function extractOpenAIError(err: unknown): string {
  if (err instanceof OpenAI.APIConnectionError) {
    return `无法连接到 API 服务器。请检查 Base URL 是否正确，以及网络是否可达。(${err.message})`
  }
  if (err instanceof OpenAI.AuthenticationError) {
    return `API Key 认证失败（401）。请检查 API Key 是否正确。`
  }
  if (err instanceof OpenAI.PermissionDeniedError) {
    return `权限不足（403）。API Key 可能没有访问该模型的权限。`
  }
  if (err instanceof OpenAI.NotFoundError) {
    return `模型或接口不存在（404）。请检查 Base URL 路径和模型名称是否正确。`
  }
  if (err instanceof OpenAI.RateLimitError) {
    return `触发速率限制（429）。API 连接正常，但当前请求过于频繁。`
  }
  if (err instanceof OpenAI.APIError) {
    return `API 返回错误 (${err.status}): ${err.message}`
  }
  if (err instanceof Error) {
    if (err.message.includes('ECONNREFUSED')) {
      return `连接被拒绝。目标服务器可能未运行或端口不正确。`
    }
    if (err.message.includes('ENOTFOUND')) {
      return `DNS 解析失败。域名不存在或网络不通。`
    }
    if (err.message.includes('ETIMEDOUT') || err.message.includes('timeout')) {
      return `连接超时。服务器无响应或网络延迟过高。`
    }
    return err.message
  }
  return String(err)
}

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json()
  const { baseUrl, apiKey, modelName } = body

  if (!baseUrl || !apiKey || !modelName) {
    throw new ApiError('BAD_REQUEST', 'baseUrl、apiKey、modelName 均为必填')
  }

  try {
    const client = new OpenAI({
      baseURL: baseUrl,
      apiKey,
      timeout: 15000,
    })

    const result = await client.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
      max_tokens: 5,
    })

    const reply = result.choices[0]?.message?.content ?? ''
    const model = result.model ?? modelName

    return NextResponse.json({
      success: true,
      model,
      reply: reply.trim(),
      message: `连接成功！模型 ${model} 已响应。`,
    })
  } catch (err) {
    const errorMessage = extractOpenAIError(err)
    return NextResponse.json({
      success: false,
      error: errorMessage,
    })
  }
})
