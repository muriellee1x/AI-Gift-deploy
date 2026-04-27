'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import GenerateProgressModal from '@/components/ui/GenerateProgressModal'
import MediaFrame from '@/components/ui/MediaFrame'
import PreviewableMedia from '@/components/ui/PreviewableMedia'
import RoomPickStep from '@/components/ui/RoomPickStep'
import SubPageHeader from '@/components/ui/SubPageHeader'
import UploadBox from '@/components/ui/UploadBox'

type PostprocessRouteKind = 'icon' | 'green' | 'general'
type RoomStepKey = 'room' | 'step1' | 'step2'

type BaConfigItem = {
  id: string
  name: string
  roomUrl: string
  isDefault: boolean
  hasCookie: boolean
}

type PostprocessConfig = {
  name: string
  pipelineKind: 'postprocessIcon' | 'postprocessGreen' | 'postprocessGeneral'
  pipelineStage: 'image' | 'post'
  inputType: 'image' | 'video'
  uploadTitle: string
  uploadDescription: string
  accept: string
  progressTitle: string
}

type IconPackResult = {
  kind: 'image-pack'
  preview: { imageUrl: string; imageKey: string; filename: string }
  icon1024: { imageUrl: string; imageKey: string; filename: string }
  icon168: { imageUrl: string; imageKey: string; filename: string }
}

type VideoPairResult = {
  kind: 'video-pair'
  bg: { videoUrl: string; videoKey: string; filename: string }
  openClaw: { videoUrl: string; videoKey: string; filename: string }
  configUrl: string
  configKey: string
}

type PostprocessPersistedState = {
  baConfigId?: string
  sourceUrl?: string
  sourceKey?: string
  iconPack?: IconPackResult | null
  videoPair?: VideoPairResult | null
  maxReached?: number
}

const STEPS = ['房间选择', '上传素材', '结果'] as const
const STEP_KEYS: readonly RoomStepKey[] = ['room', 'step1', 'step2']

const POSTPROCESS_CONFIG: Record<PostprocessRouteKind, PostprocessConfig> = {
  icon: {
    name: '礼物 icon 合成',
    pipelineKind: 'postprocessIcon',
    pipelineStage: 'image',
    inputType: 'image',
    uploadTitle: '礼物原图',
    uploadDescription: '上传一张图片，生成 iconPreview / icon1024 / icon168 三张结果图。',
    accept: 'image/*',
    progressTitle: '图片合成中',
  },
  green: {
    name: '扣绿后处理',
    pipelineKind: 'postprocessGreen',
    pipelineStage: 'post',
    inputType: 'video',
    uploadTitle: '扣绿视频',
    uploadDescription: '上传一段视频，生成 BGOutput / OpenClawOutput 与 config.json。',
    accept: 'video/mp4,.mp4',
    progressTitle: '视频合成中',
  },
  general: {
    name: '高价效通用后处理',
    pipelineKind: 'postprocessGeneral',
    pipelineStage: 'post',
    inputType: 'video',
    uploadTitle: '视频素材',
    uploadDescription: '上传一段视频，生成 BGOutput / OpenClawOutput 与 config.json。',
    accept: 'video/mp4,.mp4',
    progressTitle: '视频合成中',
  },
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

async function fetchAsBlob(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败: ${res.status}`)
  return res.blob()
}

export default function PostprocessPage({
  params,
}: {
  params: Promise<{ kind: string }>
}) {
  const searchParams = useSearchParams()
  const initialProjectId = searchParams?.get('projectId') ?? null
  const { kind } = use(params)
  const routeKind = kind as PostprocessRouteKind
  const config = POSTPROCESS_CONFIG[routeKind]

  const projectIdRef = useRef<string | null>(initialProjectId)
  const [projectLoaded, setProjectLoaded] = useState(!initialProjectId)
  const [step, setStep] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [rooms, setRooms] = useState<BaConfigItem[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [pendingRoomId, setPendingRoomId] = useState('')
  const [roomConfirming, setRoomConfirming] = useState(false)

  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceKey, setSourceKey] = useState('')
  const [uploading, setUploading] = useState(false)

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)

  const [iconPack, setIconPack] = useState<IconPackResult | null>(null)
  const [videoPair, setVideoPair] = useState<VideoPairResult | null>(null)

  const latestStateRef = useRef<PostprocessPersistedState>({})
  useEffect(() => {
    latestStateRef.current = {
      baConfigId: selectedRoomId || undefined,
      sourceUrl: sourceUrl || undefined,
      sourceKey: sourceKey || undefined,
      iconPack,
      videoPair,
      maxReached,
    }
  }, [selectedRoomId, sourceUrl, sourceKey, iconPack, videoPair, maxReached])

  const orderedRooms = useMemo(
    () => [...rooms].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    [rooms],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/ba-config')
        if (!res.ok || cancelled) return
        const data = await res.json()
        setRooms((data.configs || []) as BaConfigItem[])
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (pendingRoomId || orderedRooms.length === 0) return
    const fallback = orderedRooms[0]?.id
    if (fallback) setPendingRoomId(fallback)
  }, [orderedRooms, pendingRoomId])

  useEffect(() => {
    if (!initialProjectId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/projects/${initialProjectId}`)
        if (!res.ok) return
        const data = await res.json()
        const project = data.project
        const state = (project?.state || {}) as PostprocessPersistedState
        if (cancelled) return
        if (state.baConfigId) {
          setSelectedRoomId(state.baConfigId)
          setPendingRoomId(state.baConfigId)
        }
        if (state.sourceUrl) setSourceUrl(state.sourceUrl)
        if (state.sourceKey) setSourceKey(state.sourceKey)
        if (state.iconPack) setIconPack(state.iconPack)
        if (state.videoPair) setVideoPair(state.videoPair)
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

  const ensureProject = useCallback(async (options?: {
    currentStep?: RoomStepKey
    coverImageUrl?: string | null
    statePatch?: Partial<PostprocessPersistedState>
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
          kind: 'postprocess',
          subKind: routeKind,
          name: 'Untitled',
          currentStep: options?.currentStep || 'room',
          coverImageUrl: options?.coverImageUrl !== undefined
            ? options.coverImageUrl
            : (config.inputType === 'image' ? (sourceUrl || null) : null),
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
  }, [config.inputType, config.name, routeKind, sourceUrl])

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
        coverImageUrl: config.inputType === 'image' ? (iconPack?.preview.imageUrl || sourceUrl || null) : null,
      })
    }, 800)
    return () => clearTimeout(handle)
  }, [step, config.inputType, sourceUrl, iconPack, videoPair, selectedRoomId, sourceKey, maxReached, saveProject])

  const goToStep = (idx: number) => {
    if (idx <= maxReached) setStep(idx)
  }

  const advanceTo = (idx: number) => {
    setStep(idx)
    setMaxReached((prev) => Math.max(prev, idx))
  }

  const handleConfirmRoom = useCallback(async () => {
    if (!pendingRoomId) return
    setRoomConfirming(true)
    try {
      latestStateRef.current = {
        ...latestStateRef.current,
        baConfigId: pendingRoomId,
        maxReached: Math.max(1, latestStateRef.current.maxReached ?? 0),
      }
      setSelectedRoomId(pendingRoomId)
      await ensureProject({
        currentStep: 'step1',
        coverImageUrl: config.inputType === 'image' ? (sourceUrl || null) : null,
        statePatch: {
          baConfigId: pendingRoomId,
          maxReached: Math.max(1, latestStateRef.current.maxReached ?? 0),
        },
      })
      advanceTo(1)
      saveProject({
        currentStep: 'step1',
        coverImageUrl: config.inputType === 'image' ? (sourceUrl || null) : null,
      })
    } finally {
      setRoomConfirming(false)
    }
  }, [advanceTo, config.inputType, ensureProject, pendingRoomId, saveProject, sourceUrl])

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const endpoint = config.inputType === 'image' ? '/api/upload' : '/api/upload/video'
      const res = await fetch(endpoint, { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '上传失败')
      }
      const data = await res.json()
      if (config.inputType === 'image') {
        setSourceUrl(data.imageUrl as string)
      } else {
        setSourceUrl(data.videoUrl as string)
      }
      setSourceKey(data.storageKey as string)
      setIconPack(null)
      setVideoPair(null)
      saveProject({
        currentStep: 'step1',
        coverImageUrl: config.inputType === 'image' ? (data.imageUrl as string) : null,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }, [config.inputType])

  const handleRemoveSource = useCallback(() => {
    setSourceUrl('')
    setSourceKey('')
    setIconPack(null)
    setVideoPair(null)
  }, [])

  const handleRun = useCallback(async () => {
    if (!selectedRoomId || !sourceKey) return
    setRunning(true)
    setProgress(0)
    try {
      const payload =
        config.inputType === 'image'
          ? {
              kind: config.pipelineKind,
              stage: config.pipelineStage,
              baConfigId: selectedRoomId,
              imageKey: sourceKey,
            }
          : {
              kind: config.pipelineKind,
              stage: config.pipelineStage,
              baConfigId: selectedRoomId,
              videoKey: sourceKey,
            }
      const res = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '提交失败')
      }
      const { taskId } = await res.json()
      const result = await pollTask(taskId, setProgress)
      if (result.kind === 'image-pack') {
        setIconPack(result as unknown as IconPackResult)
      } else {
        setVideoPair(result as unknown as VideoPairResult)
      }
      advanceTo(2)
      saveProject({
        currentStep: 'step2',
        coverImageUrl: config.inputType === 'image'
          ? ((result as Record<string, unknown>).preview as { imageUrl?: string } | undefined)?.imageUrl || sourceUrl || null
          : null,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : '合成失败')
    } finally {
      setRunning(false)
    }
  }, [config.inputType, config.pipelineKind, config.pipelineStage, selectedRoomId, sourceKey])

  const handleDownload = useCallback(async () => {
    try {
      const zip = new JSZip()

      if (config.inputType === 'image' && iconPack) {
        const [originalBlob, previewBlob, icon1024Blob, icon168Blob] = await Promise.all([
          fetchAsBlob(sourceUrl),
          fetchAsBlob(iconPack.preview.imageUrl),
          fetchAsBlob(iconPack.icon1024.imageUrl),
          fetchAsBlob(iconPack.icon168.imageUrl),
        ])
        zip.file('original.png', originalBlob)
        zip.file(iconPack.preview.filename || 'iconPreview.png', previewBlob)
        zip.file(iconPack.icon1024.filename || 'icon1024.png', icon1024Blob)
        zip.file(iconPack.icon168.filename || 'icon168.png', icon168Blob)
        const content = await zip.generateAsync({ type: 'blob' })
        saveAs(content, '礼物icon合成-assets.zip')
        return
      }

      if (videoPair) {
        const [bgBlob, openClawBlob, configBlob] = await Promise.all([
          fetchAsBlob(videoPair.bg.videoUrl),
          fetchAsBlob(videoPair.openClaw.videoUrl),
          fetchAsBlob(videoPair.configUrl),
        ])
        zip.file(videoPair.bg.filename || 'BGOutput.mp4', bgBlob)
        zip.file(videoPair.openClaw.filename || 'OpenClawOutput.mp4', openClawBlob)
        zip.file('config.json', configBlob)
        const content = await zip.generateAsync({ type: 'blob' })
        saveAs(content, `${config.name}-assets.zip`)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '打包下载失败')
    }
  }, [config.inputType, config.name, iconPack, sourceUrl, videoPair])

  if (!config) {
    return <div className="py-20 text-center text-body text-fg3">未知的资产合成管线</div>
  }

  if (!projectLoaded) {
    return (
      <div className="flex items-center justify-center py-24 text-body">
        正在加载项目...
      </div>
    )
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
          <div className="space-y-6">
            <div className="text-left">
              <h2 className="text-h3">{config.uploadTitle}</h2>
              <p className="mt-2 text-14px text-fg3">{config.uploadDescription}</p>
            </div>

            <UploadBox
              title={config.uploadTitle}
              description={config.inputType === 'image' ? '支持拖拽或点击上传图片' : '支持拖拽或点击上传 MP4 视频'}
              active={!!sourceUrl}
              onSelect={handleUpload}
              accept={config.accept}
              hasFile={!!sourceUrl}
              uploading={uploading}
              onRemove={handleRemoveSource}
              previewSrc={sourceUrl}
              previewAlt={config.uploadTitle}
            />

            <div className="flex justify-end">
              <button type="button" onClick={handleRun} disabled={running || !sourceKey} className="btn-gradient">
                开始合成
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <div className="text-left">
              <h2 className="text-h3">结果</h2>
              <p className="mt-2 text-14px text-fg3">查看输出结果并打包下载素材。</p>
            </div>

            {config.inputType === 'image' && iconPack ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="content-card p-6">
                  <p className="mb-4 text-h4">原图</p>
                  <MediaFrame type="image" src={sourceUrl} alt="原图" heightClassName="h-[500px]" />
                </div>
                <div className="content-card p-6">
                  <p className="mb-4 text-h4">iconPreview</p>
                  <MediaFrame
                    type="image"
                    src={iconPack.preview.imageUrl}
                    alt="iconPreview"
                    heightClassName="h-[500px]"
                  />
                </div>
              </div>
            ) : null}

            {config.inputType === 'video' && videoPair ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="content-card p-6">
                  <p className="mb-4 text-h4">直播间效果</p>
                  <div className="flex h-[500px] items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-black/25">
                    <PreviewableMedia
                      type="video"
                      src={videoPair.bg.videoUrl}
                      alt="BGOutput"
                      wrapperClassName="flex h-full w-full items-center justify-center"
                      className="h-full w-auto max-w-full object-contain"
                    />
                  </div>
                </div>
                <div className="content-card p-6">
                  <p className="mb-4 text-h4">可上线资产</p>
                  <div className="flex h-[500px] items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-black/25">
                    <PreviewableMedia
                      type="video"
                      src={videoPair.openClaw.videoUrl}
                      alt="OpenClawOutput"
                      wrapperClassName="flex h-full w-full items-center justify-center"
                      className="h-full w-auto max-w-full object-contain"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleDownload}
                disabled={config.inputType === 'image' ? !iconPack : !videoPair}
                className="btn-gradient"
              >
                打包下载
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <GenerateProgressModal open={running} title={config.progressTitle} progress={progress} />
    </>
  )
}
