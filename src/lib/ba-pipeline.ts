import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { decryptApiKey } from '@/lib/crypto-utils'
import {
  submitPrompt,
  getHistory,
  downloadOutput,
  uploadImage,
  uploadVideo,
  type HistoryEntry,
} from '@/lib/ba-client'
import {
  uploadObject,
  generateUniqueKey,
  getObjectBuffer,
  extractStorageKey,
} from '@/lib/storage'
import { generateVideoConfig } from '@/lib/pipeline/generate-video-config'

type NodeBinding = {
  id: string
  field: string
}

type OutputAsset = {
  filename: string
  subfolder: string
  type: string
}

type OutputAssetCandidate = Partial<OutputAsset> & Record<string, unknown>

export type PipelineKind =
  | 'flower2'
  | 'flower'
  | 'food'
  | 'scene'
  | 'character'
  | 'postprocessIcon'
  | 'postprocessGreen'
  | 'postprocessGeneral'
export type PipelineStage = 'image' | 'video' | 'post'

type StageConfig = {
  workflowFile: string
  output: 'image' | 'video' | 'video-pair' | 'image-pack'
  textNodes?: NodeBinding[]
  imageNodes?: NodeBinding[]
  videoNodes?: NodeBinding[]
}

const PIPELINE_CONFIG: Record<PipelineKind, Partial<Record<PipelineStage, StageConfig>>> = {
  flower2: {
    image: {
      workflowFile: 'flower2.0-image.json',
      output: 'image',
      textNodes: [{ id: '18', field: 'text' }],
    },
    video: {
      workflowFile: 'flower2.0-video.json',
      output: 'video',
      textNodes: [{ id: '317', field: 'text' }],
      imageNodes: [{ id: '300', field: 'image' }],
    },
    post: {
      workflowFile: 'flower2.0-post.json',
      output: 'video-pair',
      textNodes: [{ id: '514', field: 'text' }],
      imageNodes: [{ id: '523', field: 'image' }],
      videoNodes: [{ id: '512', field: 'video_path' }],
    },
  },
  flower: {
    image: {
      workflowFile: 'flower1.0-image.json',
      output: 'image',
      textNodes: [{ id: '278', field: 'text' }],
    },
    video: {
      workflowFile: 'flower1.0-video.json',
      output: 'video',
      textNodes: [{ id: '506', field: 'text' }],
      imageNodes: [{ id: '609', field: 'image' }],
    },
    post: {
      workflowFile: 'flower1.0-post.json',
      output: 'video-pair',
      imageNodes: [{ id: '615', field: 'image' }],
      videoNodes: [{ id: '619', field: 'video_path' }],
    },
  },
  food: {
    image: {
      workflowFile: 'food-image.json',
      output: 'image',
      textNodes: [{ id: '487', field: 'text' }],
    },
    video: {
      workflowFile: 'food-video.json',
      output: 'video',
      textNodes: [{ id: '612', field: 'text' }],
      imageNodes: [{ id: '607', field: 'image' }],
    },
    post: {
      workflowFile: 'food-post.json',
      output: 'video-pair',
      imageNodes: [{ id: '622', field: 'image' }],
      videoNodes: [{ id: '618', field: 'video_path' }],
    },
  },
  scene: {
    image: {
      workflowFile: 'scene-image.json',
      output: 'image',
      textNodes: [{ id: '689', field: 'text' }],
    },
    video: {
      workflowFile: 'scene-video.json',
      output: 'video',
      // 当前 scene-video.json 中，BAInputSlot(input_1,text) 为节点 587，字段 text_in
      textNodes: [{ id: '587', field: 'text_in' }],
      // 当前 scene-video.json 中，用户尾帧参考图的 LoadImage 为节点 582
      imageNodes: [{ id: '582', field: 'image' }],
    },
    post: {
      workflowFile: 'scene-post.json',
      output: 'video-pair',
      textNodes: [{ id: '240', field: 'text' }],
      videoNodes: [{ id: '243', field: 'video_path' }],
    },
  },
  character: {
    image: {
      workflowFile: 'W+character.json',
      output: 'image',
      // 节点 18 (TextInput / UserPrompt) 承载用户输入的提示词
      textNodes: [{ id: '18', field: 'text' }],
    },
  },
  postprocessIcon: {
    image: {
      workflowFile: 'postprocess-icon.json',
      output: 'image-pack',
      // 节点 130 为用户上传主图的 LoadImage
      imageNodes: [{ id: '130', field: 'image' }],
    },
  },
  postprocessGreen: {
    post: {
      workflowFile: 'postprocess-green.json',
      output: 'video-pair',
      // 节点 558 为 BA Load Video，字段 video_path
      videoNodes: [{ id: '558', field: 'video_path' }],
    },
  },
  postprocessGeneral: {
    post: {
      workflowFile: 'postprocess-general.json',
      output: 'video-pair',
      // 节点 535 为 BA Load Video，字段 video_path
      videoNodes: [{ id: '535', field: 'video_path' }],
    },
  },
}

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 10 * 60 * 1000

type PipelineStageInput = {
  baConfigId?: string | null
  prompt?: string
  imageKey?: string
  videoKey?: string
  text?: string
}

type ImageStageResult = {
  kind: 'image'
  imageUrl: string
  imageKey: string
}

type ImagePackStageResult = {
  kind: 'image-pack'
  preview: { imageUrl: string; imageKey: string; filename: string }
  icon1024: { imageUrl: string; imageKey: string; filename: string }
  icon168: { imageUrl: string; imageKey: string; filename: string }
}

type VideoStageResult = {
  kind: 'video'
  videoUrl: string
  videoKey: string
  text?: string
}

type VideoPairStageResult = {
  kind: 'video-pair'
  bg: { videoUrl: string; videoKey: string; filename: string }
  openClaw: { videoUrl: string; videoKey: string; filename: string }
  configUrl: string
  configKey: string
  text?: string
}

export type PipelineStageResult = ImageStageResult | ImagePackStageResult | VideoStageResult | VideoPairStageResult

function loadWorkflowPrompt(kind: PipelineKind, stage: PipelineStage): Record<string, unknown> {
  const config = PIPELINE_CONFIG[kind]?.[stage]
  if (!config) throw new Error(`未知工作流阶段: ${kind}/${stage}`)

  const filePath = path.join(process.cwd(), 'src', 'workflows', config.workflowFile)
  const raw = fs.readFileSync(filePath, 'utf-8')
  const workflow = JSON.parse(raw) as Record<string, unknown>
  const baExtra = workflow.ba_extra as { prompt?: Record<string, unknown> } | undefined
  if (!baExtra?.prompt) {
    throw new Error(`Workflow ${config.workflowFile} 缺少 ba_extra.prompt`)
  }
  const promptCopy = JSON.parse(JSON.stringify(baExtra.prompt)) as Record<string, unknown>
  normalizeLegacyEnums(promptCopy)
  return promptCopy
}

// Seed4Sampler 等节点历史上曾把 process_type 用中文枚举导出（如「基础生成」/「多图编辑」），
// 而线上 BA 房间的 schema 只认 ['edit', 't2i']。在提交前做一次兜底映射，避免再次踩同样的坑。
function normalizeLegacyEnums(apiPrompt: Record<string, unknown>) {
  const processTypeMap: Record<string, string> = {
    基础生成: 't2i',
    多图编辑: 'edit',
  }

  for (const node of Object.values(apiPrompt)) {
    const inputs = (node as { inputs?: Record<string, unknown> } | undefined)?.inputs
    if (!inputs) continue
    const value = inputs.process_type
    if (typeof value === 'string' && value in processTypeMap) {
      inputs.process_type = processTypeMap[value]
    }
  }
}

function setNodeInput(
  apiPrompt: Record<string, unknown>,
  nodeId: string,
  field: string,
  value: string,
) {
  const node = apiPrompt[nodeId] as { inputs?: Record<string, unknown> } | undefined
  if (!node?.inputs) {
    throw new Error(`workflow 节点 ${nodeId} 不存在`)
  }
  node.inputs[field] = value
}

function injectBindings(
  apiPrompt: Record<string, unknown>,
  bindings: NodeBinding[] | undefined,
  value: string | undefined,
  label: string,
) {
  if (!bindings?.length) return
  if (!value?.trim()) {
    throw new Error(`${label} is required`)
  }
  for (const binding of bindings) {
    setNodeInput(apiPrompt, binding.id, binding.field, value)
  }
}

async function getUserBaConfig(userId: string, baConfigId?: string | null) {
  if (baConfigId) {
    const selected = await prisma.baConfig.findFirst({
      where: { id: baConfigId, userId },
    })
    if (!selected) {
      throw new Error('指定的 BA 房间不存在或无权限访问')
    }
    return selected
  }

  const config = await prisma.baConfig.findFirst({
    where: { userId, isDefault: true },
  })

  if (!config) {
    const any = await prisma.baConfig.findFirst({ where: { userId } })
    if (!any) throw new Error('未配置 BA 房间，请先在设置页面添加 BA 配置')
    return any
  }

  return config
}

function isVideoFilename(filename: string) {
  return /\.(mp4|mov|avi|mkv|webm|gif)$/i.test(filename)
}

function isImageFilename(filename: string) {
  return /\.(png|jpe?g|webp|bmp)$/i.test(filename)
}

function normalizeOutputAsset(value: unknown, kind: 'image' | 'video'): OutputAsset | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as OutputAssetCandidate
  const filename = typeof candidate.filename === 'string' ? candidate.filename.trim() : ''
  if (!filename) return null

  if (kind === 'video' && !isVideoFilename(filename)) return null
  if (kind === 'image' && !isImageFilename(filename)) return null

  return {
    filename,
    subfolder: typeof candidate.subfolder === 'string' ? candidate.subfolder : '',
    type: typeof candidate.type === 'string' ? candidate.type : 'output',
  }
}

function collectOutputAssets(value: unknown, kind: 'image' | 'video'): OutputAsset[] {
  const direct = normalizeOutputAsset(value, kind)
  if (direct) return [direct]

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectOutputAssets(item, kind))
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .flatMap((child) => collectOutputAssets(child, kind))
  }

  return []
}

function findOutputAssets(history: HistoryEntry, kind: 'image' | 'video'): OutputAsset[] {
  const assets = collectOutputAssets(history.outputs || {}, kind)
  const deduped = new Map<string, OutputAsset>()
  for (const asset of assets) {
    deduped.set(`${asset.type}:${asset.subfolder}:${asset.filename}`, asset)
  }
  return [...deduped.values()]
}

function looksLikeAssetPath(value: string): boolean {
  return /\.(png|jpe?g|webp|gif|mp4|mov|avi|mkv)$/i.test(value)
}

function collectTextCandidates(value: unknown, keyHint = ''): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || looksLikeAssetPath(trimmed)) return []

    const candidates: string[] = []
    if (/(text|string|resp_json|result|positive)/i.test(keyHint)) {
      candidates.push(trimmed)
    }

    if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length > 2) {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        candidates.push(...collectTextCandidates(parsed, 'resp_json'))
      } catch {
        /* ignore json parse failure */
      }
    }

    return candidates
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextCandidates(item, keyHint))
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, child]) => collectTextCandidates(child, key))
  }

  return []
}

function extractTextFromHistory(history: HistoryEntry): string | undefined {
  const candidates = collectTextCandidates(history.outputs, 'outputs')
    .map((item) => item.trim())
    .filter((item) => item.length > 1)

  const unique = [...new Set(candidates)]
  unique.sort((a, b) => b.length - a.length)
  return unique[0]
}

function inferContentType(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext) return undefined
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'mp4') return 'video/mp4'
  if (ext === 'mov') return 'video/quicktime'
  return undefined
}

function pickUploadedFilename(result: Record<string, unknown>, fallback: string): string {
  const value = result.name ?? result.filename ?? result.file ?? result.path
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function pickVideoPair(assets: OutputAsset[]) {
  const openClaw = assets.find((asset) => /openclawoutput__/i.test(asset.filename)) ?? assets.at(-1)
  const bg = assets.find((asset) => /bgoutput__/i.test(asset.filename))
    ?? assets.find((asset) => asset !== openClaw)
    ?? assets[0]

  if (!bg || !openClaw) {
    throw new Error('post workflow 未返回两条可用视频')
  }

  return { bg, openClaw }
}

function pickImagePack(assets: OutputAsset[]) {
  const preview = assets.find((asset) => /iconpreview__/i.test(asset.filename))
  const icon1024 = assets.find((asset) => /icon1024__/i.test(asset.filename))
  const icon168 = assets.find((asset) => /icon168__/i.test(asset.filename))

  if (!preview || !icon1024 || !icon168) {
    throw new Error('icon workflow 未返回完整的 iconPreview__/icon1024__/icon168__ 图片')
  }

  return { preview, icon1024, icon168 }
}

async function uploadHistoryAsset(
  asset: OutputAsset,
  kind: PipelineKind,
  stage: PipelineStage,
  benchBaseUrl: string,
  cookie: string,
): Promise<{ url: string; key: string; filename: string; buffer: Buffer }> {
  const buffer = await downloadOutput(
    benchBaseUrl,
    cookie,
    asset.filename,
    asset.subfolder,
    asset.type,
  )

  const ext = asset.filename.split('.').pop() || (stage === 'image' ? 'png' : 'mp4')
  const key = generateUniqueKey(`pipeline/${kind}/${stage}`, ext)
  const storedKey = await uploadObject(buffer, key, 3, inferContentType(asset.filename))

  return {
    url: `/api/files/${encodeURIComponent(storedKey)}`,
    key: storedKey,
    filename: asset.filename,
    buffer,
  }
}

async function maybeUploadReferenceImage(
  benchBaseUrl: string,
  cookie: string,
  imageKey: string,
): Promise<string> {
  const resolvedKey = extractStorageKey(imageKey) || imageKey
  const buffer = await getObjectBuffer(resolvedKey)
  const base = path.basename(resolvedKey).replace(/\.[^.]+$/, '') || 'pipeline-image'
  const filename = `${base}-${Date.now()}.png`
  const result = await uploadImage(benchBaseUrl, cookie, buffer, filename)
  return pickUploadedFilename(result, filename)
}

async function maybeUploadReferenceVideo(
  benchBaseUrl: string,
  cookie: string,
  videoKey: string,
): Promise<string> {
  const resolvedKey = extractStorageKey(videoKey) || videoKey
  const buffer = await getObjectBuffer(resolvedKey)
  const base = path.basename(resolvedKey).replace(/\.[^.]+$/, '') || 'pipeline-video'
  const filename = `${base}-${Date.now()}.mp4`
  const result = await uploadVideo(benchBaseUrl, cookie, buffer, filename)
  return pickUploadedFilename(result, filename)
}

async function waitForHistory(
  benchBaseUrl: string,
  cookie: string,
  promptId: string,
  report: (pct: number, msg: string) => void,
): Promise<HistoryEntry> {
  const startTime = Date.now()
  let lastProgress = 25

  while (true) {
    if (Date.now() - startTime > POLL_TIMEOUT_MS) {
      throw new Error('BA workflow 执行超时 (10 分钟)')
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

    const historyMap = await getHistory(benchBaseUrl, cookie, promptId)
    const entry = historyMap[promptId]

    if (!entry) {
      lastProgress = Math.min(lastProgress + 2, 70)
      report(lastProgress, '等待 BA 房间处理...')
      continue
    }

    const statusStr = entry.status?.status_str ?? ''
    if (statusStr === 'error' || statusStr === 'failed') {
      const detail = (entry.status?.messages || [])
        .map((message) => message.message || message.details || '')
        .filter(Boolean)
        .join('; ')
      throw new Error(`BA workflow 执行失败${detail ? `: ${detail}` : ''}`)
    }

    if (entry.status?.completed) {
      return entry
    }

    lastProgress = Math.min(lastProgress + 3, 70)
    report(lastProgress, 'BA 房间正在处理...')
  }
}

export async function runPipelineStage(
  userId: string,
  kind: PipelineKind,
  stage: PipelineStage,
  input: PipelineStageInput,
  onProgress?: (pct: number, message: string) => void,
): Promise<PipelineStageResult> {
  const stageConfig = PIPELINE_CONFIG[kind]?.[stage]
  if (!stageConfig) {
    throw new Error(`未知工作流阶段: ${kind}/${stage}`)
  }

  const report = (pct: number, msg: string) => onProgress?.(pct, msg)

  report(5, '加载 workflow...')
  const apiPrompt = loadWorkflowPrompt(kind, stage)

  if ((stage === 'image' || stage === 'video') && stageConfig.textNodes?.length) {
    report(10, '注入提示词...')
    injectBindings(apiPrompt, stageConfig.textNodes, input.prompt, 'prompt')
  } else if (stage === 'post' && stageConfig.textNodes?.length && input.text?.trim()) {
    report(10, '注入 post 文本...')
    injectBindings(apiPrompt, stageConfig.textNodes, input.text, 'text')
  }

  report(15, '获取 BA 配置...')
  const baConfig = await getUserBaConfig(userId, input.baConfigId)

  if (!baConfig.benchBaseUrl) {
    throw new Error('BA 配置缺少 benchBaseUrl，请检查房间 URL 配置')
  }
  if (!baConfig.cookieHeader) {
    throw new Error('BA 配置缺少 Cookie，请先获取 Cookie')
  }

  const cookie = decryptApiKey(baConfig.cookieHeader)

  if (stageConfig.imageNodes?.length) {
    if (!input.imageKey) throw new Error('imageKey is required')
    report(18, '上传参考图片到 BA 房间...')
    const uploadedImageName = await maybeUploadReferenceImage(baConfig.benchBaseUrl, cookie, input.imageKey)
    injectBindings(apiPrompt, stageConfig.imageNodes, uploadedImageName, 'image')
  }

  if (stageConfig.videoNodes?.length) {
    if (!input.videoKey) throw new Error('videoKey is required')
    report(18, '上传参考视频到 BA 房间...')
    const uploadedVideoName = await maybeUploadReferenceVideo(baConfig.benchBaseUrl, cookie, input.videoKey)
    injectBindings(apiPrompt, stageConfig.videoNodes, uploadedVideoName, 'video')
  }

  report(20, '提交 workflow 到 BA 房间...')
  const submitResult = await submitPrompt(baConfig.benchBaseUrl, cookie, apiPrompt)
  const promptId = submitResult.prompt_id
  if (!promptId) {
    throw new Error('BA 房间未返回 prompt_id')
  }

  report(25, `任务已提交 (prompt_id: ${promptId})，等待执行...`)
  const history = await waitForHistory(baConfig.benchBaseUrl, cookie, promptId, report)

  if (stageConfig.output === 'image') {
    report(78, '提取输出图片...')
    const images = findOutputAssets(history, 'image')
    if (images.length === 0) {
      throw new Error('workflow 完成但未找到输出图片')
    }
    const uploaded = await uploadHistoryAsset(images[0], kind, stage, baConfig.benchBaseUrl, cookie)
    report(100, '完成')
    return {
      kind: 'image',
      imageUrl: uploaded.url,
      imageKey: uploaded.key,
    }
  }

  if (stageConfig.output === 'image-pack') {
    report(78, '提取输出图片...')
    const images = findOutputAssets(history, 'image')
    if (images.length === 0) {
      throw new Error('workflow 完成但未找到输出图片')
    }
    const pack = pickImagePack(images)
    const [preview, icon1024, icon168] = await Promise.all([
      uploadHistoryAsset(pack.preview, kind, stage, baConfig.benchBaseUrl, cookie),
      uploadHistoryAsset(pack.icon1024, kind, stage, baConfig.benchBaseUrl, cookie),
      uploadHistoryAsset(pack.icon168, kind, stage, baConfig.benchBaseUrl, cookie),
    ])
    report(100, '完成')
    return {
      kind: 'image-pack',
      preview: {
        imageUrl: preview.url,
        imageKey: preview.key,
        filename: preview.filename,
      },
      icon1024: {
        imageUrl: icon1024.url,
        imageKey: icon1024.key,
        filename: icon1024.filename,
      },
      icon168: {
        imageUrl: icon168.url,
        imageKey: icon168.key,
        filename: icon168.filename,
      },
    }
  }

  const text = extractTextFromHistory(history)
  report(78, '提取输出视频...')
  const videos = findOutputAssets(history, 'video')
  if (videos.length === 0) {
    try {
      console.error('[Pipeline] 未找到视频输出，history.outputs=', JSON.stringify(history.outputs).slice(0, 5000))
    } catch {
      console.error('[Pipeline] 未找到视频输出，且 history.outputs 无法序列化')
    }
    throw new Error('workflow 完成但未找到输出视频')
  }

  if (stageConfig.output === 'video') {
    const uploaded = await uploadHistoryAsset(videos[0], kind, stage, baConfig.benchBaseUrl, cookie)
    report(100, '完成')
    return {
      kind: 'video',
      videoUrl: uploaded.url,
      videoKey: uploaded.key,
      text,
    }
  }

  const pair = pickVideoPair(videos)
  const [bg, openClaw] = await Promise.all([
    uploadHistoryAsset(pair.bg, kind, stage, baConfig.benchBaseUrl, cookie),
    uploadHistoryAsset(pair.openClaw, kind, stage, baConfig.benchBaseUrl, cookie),
  ])

  report(92, '生成 config.json...')
  const config = await generateVideoConfig(openClaw.buffer, openClaw.filename)
  const configKey = generateUniqueKey(`pipeline/${kind}/${stage}`, 'json')
  const storedConfigKey = await uploadObject(
    Buffer.from(JSON.stringify(config)),
    configKey,
    3,
    'application/json',
  )

  report(100, '完成')
  return {
    kind: 'video-pair',
    bg: {
      videoUrl: bg.url,
      videoKey: bg.key,
      filename: bg.filename,
    },
    openClaw: {
      videoUrl: openClaw.url,
      videoKey: openClaw.key,
      filename: openClaw.filename,
    },
    configUrl: `/api/files/${encodeURIComponent(storedConfigKey)}`,
    configKey: storedConfigKey,
    text,
  }
}
