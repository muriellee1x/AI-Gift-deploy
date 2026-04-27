import { GoogleGenAI } from '@google/genai'
import { prisma } from './prisma'
import { decryptApiKey } from './crypto-utils'
import { uploadObject, generateUniqueKey } from './storage'

export type ImageGenerationResult = {
  imageUrl: string
  storageKey: string
}

type ImageCallOptions = {
  resolution?: '1K' | '2K' | '4K'
}

const IMAGE_API_MAX_RETRIES = 3
const IMAGE_API_RETRY_BASE_MS = 5000

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function callUserImageAPI(
  userId: string,
  prompt: string,
  referenceImages?: Buffer[],
  apiConfigId?: string,
  _options?: ImageCallOptions,
): Promise<ImageGenerationResult> {
  const config = apiConfigId
    ? await prisma.apiConfig.findFirst({ where: { id: apiConfigId, userId, category: 'image' } })
    : await prisma.apiConfig.findFirst({ where: { userId, category: 'image', isDefault: true } })

  if (!config) {
    throw new Error('请先在「设置」页配置默认的图片生成 API（类别选择"图片生成模型"并设为默认）')
  }

  let apiKey: string
  try {
    apiKey = decryptApiKey(config.apiKey)
  } catch {
    throw new Error('图片 API Key 解密失败，请重新在设置页保存')
  }

  const baseUrl = config.baseUrl.replace(/\/v1(beta)?\/?\s*$/, '')

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { apiVersion: 'v1beta', baseUrl },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [{ text: prompt }]

  if (referenceImages && referenceImages.length > 0) {
    for (const buf of referenceImages) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: buf.toString('base64'),
        },
      })
    }
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < IMAGE_API_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = IMAGE_API_RETRY_BASE_MS * Math.pow(2, attempt - 1)
      console.log(`[image-call] retry ${attempt}/${IMAGE_API_MAX_RETRIES}, waiting ${delay}ms...`)
      await sleep(delay)
    }

    try {
      const response = await ai.models.generateContent({
        model: config.modelName,
        contents: [{ parts }],
        config: {
          responseModalities: ['IMAGE'],
        },
      })

      const candidates = response.candidates
      if (!candidates || candidates.length === 0) {
        throw new Error('图片生成 API 返回了空结果')
      }

      const imageParts = candidates[0]?.content?.parts
      if (!imageParts) {
        throw new Error('图片生成 API 返回格式异常')
      }

      for (const part of imageParts) {
        if (part.inlineData?.data) {
          const imageBuffer = Buffer.from(part.inlineData.data, 'base64')
          const key = generateUniqueKey('generated', 'png')
          const storageKey = await uploadObject(imageBuffer, key, 3, 'image/png')

          return {
            imageUrl: `/api/files/${encodeURIComponent(storageKey)}`,
            storageKey,
          }
        }
      }

      throw new Error('图片生成 API 未返回图片数据')
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const msg = lastError.message || ''
      const isRetryable = msg.includes('fetch failed')
        || msg.includes('ECONNRESET')
        || msg.includes('ETIMEDOUT')
        || msg.includes('429')
        || msg.includes('503')
        || msg.includes('rate')
      if (!isRetryable) throw lastError
      console.log(`[image-call] attempt ${attempt + 1} failed: ${msg}`)
    }
  }

  throw new Error(`图片生成失败（已重试 ${IMAGE_API_MAX_RETRIES} 次）：${lastError?.message || 'unknown'}`)
}
