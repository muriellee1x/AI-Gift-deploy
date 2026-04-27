'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import GenerateProgressModal from '@/components/ui/GenerateProgressModal'
import SubPageHeader from '@/components/ui/SubPageHeader'
import ImageEditModal from '@/components/ui/ImageEditModal'
import PreviewableMedia from '@/components/ui/PreviewableMedia'
import RoomPickStep from '@/components/ui/RoomPickStep'

type PipelineSlug = 'flower2' | 'flower' | 'food' | 'scene'
type RoomStepKey = 'room' | 'step1' | 'step2' | 'step3' | 'step4'

type PipelineConfig = {
  name: string
  placeholder: string
  tags?: string[]
}

type PipelinePersistedState = {
  baConfigId?: string
  selectedTag?: string
  prompt?: string
  editImagePrompt?: string
  imageUrl?: string
  imageKey?: string
  videoUrl?: string
  videoKey?: string
  videoText?: string
  bgVideoUrl?: string
  bgVideoKey?: string
  openClawVideoUrl?: string
  openClawVideoKey?: string
  configUrl?: string
  configKey?: string
  maxReached?: number
}

type BaConfigItem = {
  id: string
  name: string
  roomUrl: string
  isDefault: boolean
  hasCookie: boolean
}


const PIPELINE_CONFIG: Record<PipelineSlug, PipelineConfig> = {
  flower2: {
    name: '花花管线 V2.0',
    placeholder: '请输入任意和花朵有关的关键词，越详细效果越好哦~',
    tags: ['99-500钻', '500-1000钻', '1000-3000钻'],
  },
  flower: {
    name: '花花管线 V1.0',
    placeholder: '简单输入想要的花朵类型及颜色，例如“粉红色玫瑰花”',
  },
  food: {
    name: '美食管线',
    placeholder: '输入想要的美食名称，例如“焦糖布丁”',
    tags: ['真实风格', '可爱风格'],
  },
  scene: {
    name: '景观管线',
    placeholder: '输入想要的景观关键词，例如“森林中的魔法树屋”',
    tags: ['500-1000钻', '1000-2000钻'],
  },
}

const STEPS = ['房间选择', '提示词', '礼物图', '礼物视频', '资产合成'] as const
const STEP_KEYS: readonly RoomStepKey[] = ['room', 'step1', 'step2', 'step3', 'step4']
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applyTag(prompt: string, previousTag: string, nextTag: string) {
  const withoutPrev = previousTag
    ? prompt.replace(new RegExp(`^${escapeRegExp(previousTag)}\\s*`), '').trim()
    : prompt.trim()
  return nextTag ? `${nextTag} ${withoutPrev}`.trim() : withoutPrev
}

async function pollTask(taskId: string, onProgress: (value: number) => void) {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const res = await fetch(`/api/tasks/${taskId}`)
    if (!res.ok) throw new Error('轮询任务失败')
    const data = await res.json()
    const task = data.task
    if (typeof task.progress === 'number') onProgress(task.progress)
    if (task.status === 'completed') return (task.result ?? {}) as Record<string, unknown>
    if (task.status === 'failed') throw new Error(task.errorMessage || '任务失败')
  }
}

function PromptStep({
  prompt,
  tags,
  selectedTag,
  onTagClick,
  setPrompt,
  placeholder,
  onGenerate,
  disabled,
}: {
  prompt: string
  tags?: string[]
  selectedTag: string
  onTagClick: (tag: string) => void
  setPrompt: (value: string) => void
  placeholder: string
  onGenerate: () => void
  disabled: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="text-left">
        <h2 className="text-h3">输入提示词</h2>
        <p className="mt-2 text-left text-fg3">填写当前管线的描述词，若存在风格/价效标签，可先点标签再继续补充内容。</p>
      </div>

      <div className="prompt-box relative p-2 pr-2">
        <textarea
          className="scrollbar-prompt min-h-[180px] w-full resize-none rounded-[var(--radius-card)] border-0 bg-transparent p-5 pb-16 text-body outline-none placeholder:text-fg3"
          placeholder={placeholder}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={disabled}
        />
        <div className="pointer-events-none absolute inset-x-5 bottom-4 flex flex-wrap items-center gap-2 text-caption text-fg3">
          {tags?.map((tag) => (
            <span
              key={tag}
              className={`pointer-events-auto inline-flex cursor-pointer items-center rounded-full px-3 py-1 ${
                selectedTag === tag ? 'bg-white/10 text-fg' : 'bg-white/5 text-fg3'
              }`}
              onClick={() => onTagClick(tag)}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onGenerate} disabled={disabled || !prompt.trim()} className="btn-gradient">
          生成图片
        </button>
      </div>
    </div>
  )
}

function MediaCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="content-card flex flex-col p-6">
      <p className="mb-4 text-h4">{title}</p>
      {children}
    </div>
  )
}

export default function PipelinePage({
  params,
}: {
  params: Promise<{ pipeline: string }>
}) {
  const { pipeline } = use(params)
  const slug = pipeline as PipelineSlug
  const config = PIPELINE_CONFIG[slug]
  const searchParams = useSearchParams()
  const initialProjectId = searchParams?.get('projectId') ?? null
  const projectIdRef = useRef<string | null>(initialProjectId)
  const uploadImageRef = useRef<HTMLInputElement>(null)

  const [projectLoaded, setProjectLoaded] = useState(!initialProjectId)
  const [step, setStep] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [rooms, setRooms] = useState<BaConfigItem[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [pendingRoomId, setPendingRoomId] = useState('')

  const [selectedTag, setSelectedTag] = useState('')
  const [prompt, setPrompt] = useState('')
  const [editImagePrompt, setEditImagePrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageKey, setImageKey] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoKey, setVideoKey] = useState('')
  const [videoText, setVideoText] = useState('')
  const [bgVideoUrl, setBgVideoUrl] = useState('')
  const [bgVideoKey, setBgVideoKey] = useState('')
  const [openClawVideoUrl, setOpenClawVideoUrl] = useState('')
  const [openClawVideoKey, setOpenClawVideoKey] = useState('')
  const [configUrl, setConfigUrl] = useState('')
  const [configKey, setConfigKey] = useState('')

  const [imageGenerating, setImageGenerating] = useState(false)
  const [imageProgress, setImageProgress] = useState(0)
  const [videoGenerating, setVideoGenerating] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  const [postGenerating, setPostGenerating] = useState(false)
  const [postProgress, setPostProgress] = useState(0)
  const [roomConfirming, setRoomConfirming] = useState(false)

  const [editModalOpen, setEditModalOpen] = useState(false)

  const latestStateRef = useRef<PipelinePersistedState>({})
  useEffect(() => {
    latestStateRef.current = {
      baConfigId: selectedRoomId || undefined,
      selectedTag: selectedTag || undefined,
      prompt: prompt || undefined,
      editImagePrompt: editImagePrompt || undefined,
      imageUrl: imageUrl || undefined,
      imageKey: imageKey || undefined,
      videoUrl: videoUrl || undefined,
      videoKey: videoKey || undefined,
      videoText: videoText || undefined,
      bgVideoUrl: bgVideoUrl || undefined,
      bgVideoKey: bgVideoKey || undefined,
      openClawVideoUrl: openClawVideoUrl || undefined,
      openClawVideoKey: openClawVideoKey || undefined,
      configUrl: configUrl || undefined,
      configKey: configKey || undefined,
      maxReached,
    }
  }, [
    selectedRoomId, selectedTag, prompt, editImagePrompt, imageUrl, imageKey, videoUrl, videoKey, videoText,
    bgVideoUrl, bgVideoKey, openClawVideoUrl, openClawVideoKey, configUrl, configKey, maxReached,
  ])

  const orderedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
  }, [rooms])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [baRes, apiRes] = await Promise.all([
          fetch('/api/ba-config'),
          fetch('/api/api-config'),
        ])
        if (!cancelled && baRes.ok) {
          const data = await baRes.json()
          setRooms((data.configs || []) as BaConfigItem[])
        }
        if (!cancelled && apiRes.ok) {
          await apiRes.json()
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!initialProjectId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/projects/${initialProjectId}`)
        if (!res.ok) return
        const data = await res.json()
        const project = data.project
        const state = (project?.state || {}) as PipelinePersistedState
        if (cancelled) return
        if (state.baConfigId) {
          setSelectedRoomId(state.baConfigId)
          setPendingRoomId(state.baConfigId)
        }
        if (state.selectedTag) setSelectedTag(state.selectedTag)
        if (state.prompt) setPrompt(state.prompt)
        if (state.editImagePrompt) setEditImagePrompt(state.editImagePrompt)
        if (state.imageUrl) setImageUrl(state.imageUrl)
        if (state.imageKey) setImageKey(state.imageKey)
        if (state.videoUrl) setVideoUrl(state.videoUrl)
        if (state.videoKey) setVideoKey(state.videoKey)
        if (state.videoText) setVideoText(state.videoText)
        if (state.bgVideoUrl) setBgVideoUrl(state.bgVideoUrl)
        if (state.bgVideoKey) setBgVideoKey(state.bgVideoKey)
        if (state.openClawVideoUrl) setOpenClawVideoUrl(state.openClawVideoUrl)
        if (state.openClawVideoKey) setOpenClawVideoKey(state.openClawVideoKey)
        if (state.configUrl) setConfigUrl(state.configUrl)
        if (state.configKey) setConfigKey(state.configKey)
        const stepIdx = Math.max(0, STEP_KEYS.indexOf((project?.currentStep || 'room') as RoomStepKey))
        setStep(stepIdx)
        setMaxReached(typeof state.maxReached === 'number' ? state.maxReached : stepIdx)
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setProjectLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialProjectId])

  useEffect(() => {
    if (pendingRoomId || rooms.length === 0) return
    const fallback = orderedRooms[0]?.id
    if (fallback) setPendingRoomId(fallback)
  }, [orderedRooms, pendingRoomId, rooms.length])

  const ensureProject = useCallback(async (options?: {
    currentStep?: RoomStepKey
    coverImageUrl?: string | null
    statePatch?: Partial<PipelinePersistedState>
  }): Promise<string | null> => {
    if (projectIdRef.current) return projectIdRef.current
    try {
      const nextState = {
        ...latestStateRef.current,
        ...(options?.statePatch || {}),
      }
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'vertical',
          subKind: slug,
          name: 'Untitled',
          currentStep: options?.currentStep || 'room',
          coverImageUrl: options?.coverImageUrl !== undefined ? options.coverImageUrl : (imageUrl || null),
          state: nextState,
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      const id = data.project?.id as string | undefined
      if (!id) return null
      projectIdRef.current = id
      try {
        const url = new URL(window.location.href)
        url.searchParams.set('projectId', id)
        window.history.replaceState(null, '', url.toString())
      } catch {
        /* ignore */
      }
      return id
    } catch {
      return null
    }
  }, [config.name, imageUrl, slug])

  const saveProject = useCallback(async (patch: { currentStep?: RoomStepKey; coverImageUrl?: string | null }) => {
    const id = projectIdRef.current
    if (!id) return
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...patch,
          state: latestStateRef.current,
        }),
      })
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!projectIdRef.current) return
    const handle = setTimeout(() => {
      saveProject({
        currentStep: STEP_KEYS[Math.max(0, Math.min(STEP_KEYS.length - 1, step))],
        coverImageUrl: imageUrl || null,
      })
    }, 800)
    return () => clearTimeout(handle)
  }, [step, imageUrl, prompt, imageKey, videoUrl, videoKey, videoText, bgVideoUrl, openClawVideoUrl, configUrl, selectedRoomId, selectedTag, maxReached, saveProject])

  const clearGeneratedAssets = useCallback(() => {
    setImageUrl('')
    setImageKey('')
    setVideoUrl('')
    setVideoKey('')
    setVideoText('')
    setBgVideoUrl('')
    setBgVideoKey('')
    setOpenClawVideoUrl('')
    setOpenClawVideoKey('')
    setConfigUrl('')
    setConfigKey('')
  }, [])

  const goToStep = useCallback((idx: number) => {
    if (idx <= maxReached) setStep(idx)
  }, [maxReached])

  const advanceTo = useCallback((idx: number) => {
    setStep(idx)
    setMaxReached((prev) => Math.max(prev, idx))
  }, [])

  const runPipelineStage = useCallback(async (
    stage: 'image' | 'video' | 'post',
    onProgress: (value: number) => void,
  ) => {
    const projectId = await ensureProject()
    const res = await fetch('/api/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: projectId || undefined,
        kind: slug,
        stage,
        baConfigId: selectedRoomId,
        prompt: prompt.trim() || undefined,
        imageKey: imageKey || undefined,
        videoKey: videoKey || undefined,
        text: videoText || prompt.trim() || undefined,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `${stage} 阶段提交失败`)
    }
    const data = await res.json()
    return await pollTask(data.taskId as string, onProgress)
  }, [ensureProject, imageKey, prompt, selectedRoomId, slug, videoKey, videoText])

  const handleConfirmRoom = useCallback(async () => {
    if (!pendingRoomId) return
    setRoomConfirming(true)
    try {
      const previousRoomId = selectedRoomId
      const hasGenerated = Boolean(imageUrl || videoUrl || bgVideoUrl || openClawVideoUrl)
      if (previousRoomId && previousRoomId !== pendingRoomId && hasGenerated) {
        const confirmed = window.confirm('切换房间会清空当前已生成的图像与视频结果，是否继续？')
        if (!confirmed) return
        clearGeneratedAssets()
        setMaxReached(1)
      }
      latestStateRef.current = {
        ...latestStateRef.current,
        baConfigId: pendingRoomId,
        maxReached: Math.max(1, latestStateRef.current.maxReached ?? 0),
      }
      setSelectedRoomId(pendingRoomId)
      await ensureProject({
        currentStep: 'step1',
        coverImageUrl: imageUrl || null,
        statePatch: {
          baConfigId: pendingRoomId,
          maxReached: Math.max(1, latestStateRef.current.maxReached ?? 0),
        },
      })
      advanceTo(1)
      saveProject({ currentStep: 'step1', coverImageUrl: imageUrl || null })
    } finally {
      setRoomConfirming(false)
    }
  }, [advanceTo, bgVideoUrl, clearGeneratedAssets, ensureProject, imageUrl, openClawVideoUrl, pendingRoomId, saveProject, selectedRoomId, videoUrl])

  const handleTagClick = useCallback((tag: string) => {
    const nextTag = selectedTag === tag ? '' : tag
    setPrompt((current) => applyTag(current, selectedTag, nextTag))
    setSelectedTag(nextTag)
  }, [selectedTag])

  const handleGenerateImage = useCallback(async () => {
    if (!prompt.trim() || !selectedRoomId) return
    setImageGenerating(true)
    setImageProgress(0)
    try {
      const result = await runPipelineStage('image', setImageProgress)
      const nextImageUrl = result.imageUrl as string
      const nextImageKey = result.imageKey as string
      setImageUrl(nextImageUrl)
      setImageKey(nextImageKey)
      setVideoUrl('')
      setVideoKey('')
      setVideoText('')
      setBgVideoUrl('')
      setBgVideoKey('')
      setOpenClawVideoUrl('')
      setOpenClawVideoKey('')
      setConfigUrl('')
      setConfigKey('')
      advanceTo(2)
      saveProject({ currentStep: 'step2', coverImageUrl: nextImageUrl })
    } catch (err) {
      alert(err instanceof Error ? err.message : '生成图片失败')
    } finally {
      setImageGenerating(false)
    }
  }, [advanceTo, prompt, runPipelineStage, saveProject, selectedRoomId])

  const handleUploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('仅支持图片文件')
      return
    }
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '图片上传失败')
      }
      const data = await res.json()
      setImageUrl(data.imageUrl as string)
      setImageKey(data.storageKey as string)
      setVideoUrl('')
      setVideoKey('')
      setVideoText('')
      setBgVideoUrl('')
      setBgVideoKey('')
      setOpenClawVideoUrl('')
      setOpenClawVideoKey('')
      setConfigUrl('')
      setConfigKey('')
      advanceTo(2)
      await ensureProject()
      saveProject({ currentStep: 'step2', coverImageUrl: data.imageUrl as string })
    } catch (err) {
      alert(err instanceof Error ? err.message : '图片上传失败')
    }
  }, [advanceTo, ensureProject, saveProject])

  const handleGenerateVideo = useCallback(async () => {
    if (!imageKey || !selectedRoomId) return
    setVideoGenerating(true)
    setVideoProgress(0)
    try {
      const result = await runPipelineStage('video', setVideoProgress)
      setVideoUrl(result.videoUrl as string)
      setVideoKey(result.videoKey as string)
      setVideoText((result.text as string) || '')
      setBgVideoUrl('')
      setBgVideoKey('')
      setOpenClawVideoUrl('')
      setOpenClawVideoKey('')
      setConfigUrl('')
      setConfigKey('')
      advanceTo(3)
      saveProject({ currentStep: 'step3', coverImageUrl: imageUrl || null })
    } catch (err) {
      alert(err instanceof Error ? err.message : '生成视频失败')
    } finally {
      setVideoGenerating(false)
    }
  }, [advanceTo, imageKey, imageUrl, runPipelineStage, saveProject, selectedRoomId])

  const handleComposeAssets = useCallback(async () => {
    if (!videoKey || !selectedRoomId) return
    setPostGenerating(true)
    setPostProgress(0)
    try {
      const result = await runPipelineStage('post', setPostProgress)
      const bg = result.bg as { videoUrl: string; videoKey: string } | undefined
      const openClaw = result.openClaw as { videoUrl: string; videoKey: string } | undefined
      setBgVideoUrl(bg?.videoUrl || '')
      setBgVideoKey(bg?.videoKey || '')
      setOpenClawVideoUrl(openClaw?.videoUrl || '')
      setOpenClawVideoKey(openClaw?.videoKey || '')
      setConfigUrl((result.configUrl as string) || '')
      setConfigKey((result.configKey as string) || '')
      advanceTo(4)
      saveProject({ currentStep: 'step4', coverImageUrl: imageUrl || null })
    } catch (err) {
      alert(err instanceof Error ? err.message : '合成资产失败')
    } finally {
      setPostGenerating(false)
    }
  }, [advanceTo, imageUrl, runPipelineStage, saveProject, selectedRoomId, videoKey])

  const handleDownload = useCallback(async () => {
    if (!bgVideoUrl || !openClawVideoUrl || !configUrl) return
    try {
      const zip = new JSZip()
      const [bgRes, openClawRes, configRes] = await Promise.all([
        fetch(bgVideoUrl),
        fetch(openClawVideoUrl),
        fetch(configUrl),
      ])
      if (!bgRes.ok || !openClawRes.ok || !configRes.ok) {
        throw new Error('打包下载文件失败')
      }
      zip.file('BGOutput.mp4', await bgRes.blob())
      zip.file('OpenClawOutput.mp4', await openClawRes.blob())
      zip.file('config.json', await configRes.text())
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${config.name}-assets.zip`)
    } catch (err) {
      alert(err instanceof Error ? err.message : '打包下载失败')
    }
  }, [bgVideoUrl, config.name, configUrl, openClawVideoUrl])

  if (!config) {
    return <div className="py-20 text-center text-body text-fg3">未知管线类型：{pipeline}</div>
  }

  if (!projectLoaded) {
    return <div className="flex items-center justify-center py-24 text-body">正在加载项目...</div>
  }

  return (
    <>
      <div className="space-y-6">
        <SubPageHeader
          title={config.name}
          steps={STEPS}
          current={step}
          maxReached={maxReached}
          onStepClick={goToStep}
        />

        {step === 0 ? (
          <RoomPickStep
            rooms={orderedRooms}
            selectedRoomId={pendingRoomId}
            onSelect={setPendingRoomId}
            onConfirm={handleConfirmRoom}
            disabled={roomConfirming}
          />
        ) : null}

        {step === 1 ? (
          <PromptStep
            prompt={prompt}
            tags={config.tags}
            selectedTag={selectedTag}
            onTagClick={handleTagClick}
            setPrompt={setPrompt}
            placeholder={config.placeholder}
            onGenerate={handleGenerateImage}
            disabled={imageGenerating}
          />
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <div className="text-left">
                <h2 className="text-h3">礼物图</h2>
                <p className="mt-2 text-14px text-fg3">你可以上传图像、编辑图像或基于当前提示词重新生成，再继续生成视频。</p>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <MediaCard title="生成图像">
                <div className="flex h-[500px] items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-black/25">
                  {imageUrl ? (
                    <PreviewableMedia
                      type="image"
                      src={imageUrl}
                      alt="礼物图"
                      wrapperClassName="flex h-full w-full items-center justify-center"
                      className="h-full w-auto max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-12px text-white/20">暂无礼物图</div>
                  )}
                </div>
              </MediaCard>

              <MediaCard title="提示词">
                <div className="inbox-prompt-box relative p-0 pr-2">
                  <textarea
                    className="scrollbar-prompt min-h-[420px] w-full resize-none rounded-[var(--radius-card)] border-0 bg-transparent p-5 pb-16 text-body outline-none placeholder:text-fg3"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={config.placeholder}
                    disabled={imageGenerating || videoGenerating}
                  />
                  <div className="pointer-events-none absolute inset-x-5 bottom-4 flex flex-wrap items-center gap-2 text-caption text-fg3">
                    {selectedTag ? <span>{selectedTag}</span> : <span>{config.placeholder}</span>}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => uploadImageRef.current?.click()} className="btn-secondary-pill">上传图像</button>
                  <button type="button" onClick={() => setEditModalOpen(true)} disabled={!imageUrl} className="btn-secondary-pill">编辑图像</button>
                  <button type="button" onClick={handleGenerateImage} disabled={imageGenerating || !prompt.trim()} className="btn-secondary-pill">重新生成</button>
                  <input
                    ref={uploadImageRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleUploadImage(file)
                      e.currentTarget.value = ''
                    }}
                  />
                </div>
              </MediaCard>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={handleGenerateVideo} disabled={!imageKey || videoGenerating} className="btn-gradient">
                生成视频
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6">
            <div className="text-left">
              <h2 className="text-h3">礼物视频</h2>
              <p className="mt-2 text-14px text-fg3">预览生成好的视频，并继续进入资产合成阶段。</p>
            </div>

            <div className="content-card flex flex-col p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-h4">生成视频</p>
                <button type="button" onClick={handleGenerateVideo} disabled={!imageKey || videoGenerating} className="btn-secondary-pill">
                  重新生成
                </button>
              </div>
              <div className="flex h-[500px] items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-black/25">
                {videoUrl ? (
                  <PreviewableMedia
                    type="video"
                    src={videoUrl}
                    alt="礼物视频"
                    wrapperClassName="flex h-full w-full items-center justify-center"
                    className="h-full w-auto max-w-full object-contain"
                  />
                ) : (
                  <div className="text-12px text-white/20">暂无视频结果</div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={handleComposeAssets} disabled={!videoKey || postGenerating} className="btn-gradient">
                合成资产
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-6">
            <div className="text-left">
              <h2 className="text-h3">资产合成</h2>
              <p className="mt-2 text-14px text-fg3">查看两条输出视频，并将视频与配置文件一起打包下载。</p>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <MediaCard title="直播间效果">
                <div className="flex h-[500px] items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-black/25">
                  {bgVideoUrl ? (
                    <PreviewableMedia
                      type="video"
                      src={bgVideoUrl}
                      alt="BGOutput"
                      wrapperClassName="flex h-full w-full items-center justify-center"
                      className="h-full w-auto max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-12px text-white/20">暂无直播间效果</div>
                  )}
                </div>
              </MediaCard>

              <MediaCard title="可上线资产">
                <div className="flex h-[500px] items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-black/25">
                  {openClawVideoUrl ? (
                    <PreviewableMedia
                      type="video"
                      src={openClawVideoUrl}
                      alt="OpenClawOutput"
                      wrapperClassName="flex h-full w-full items-center justify-center"
                      className="h-full w-auto max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-12px text-white/20">暂无可上线资产</div>
                  )}
                </div>
              </MediaCard>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={handleDownload} disabled={!bgVideoUrl || !openClawVideoUrl || !configUrl} className="btn-gradient">
                打包下载
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <ImageEditModal
        open={editModalOpen}
        imageUrl={imageUrl}
        imageStorageKey={imageKey || undefined}
        promptValue={editImagePrompt}
        onPromptChange={setEditImagePrompt}
        onClose={() => setEditModalOpen(false)}
        onConfirm={({ imageUrl: url, storageKey }) => {
          setImageUrl(url)
          if (storageKey) setImageKey(storageKey)
          setEditModalOpen(false)
          saveProject({ currentStep: 'step2', coverImageUrl: url })
        }}
      />

      <GenerateProgressModal open={imageGenerating} title="图片生成中" progress={imageProgress} />
      <GenerateProgressModal open={videoGenerating} title="视频生成中" progress={videoProgress} />
      <GenerateProgressModal open={postGenerating} title="资产合成中" progress={postProgress} />
    </>
  )
}
