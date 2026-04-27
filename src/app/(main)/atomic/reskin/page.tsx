'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import GenerateProgressModal from '@/components/ui/GenerateProgressModal'
import PostprocessComposeStep, {
  type ComposeBaConfigItem,
  type ComposeOutput,
  type ComposePipeline,
} from '@/components/ui/PostprocessComposeStep'
import SubPageHeader from '@/components/ui/SubPageHeader'
import PreviewableMedia from '@/components/ui/PreviewableMedia'
import UploadBox from '@/components/ui/UploadBox'
import { storageKeyFromFileUrl } from '@/lib/storage/utils'

type ReskinPersistedState = {
  videoUrl?: string
  videoStorageKey?: string
  imageUrl?: string
  imageStorageKey?: string
  videoPrompt?: string
  resultVideoUrl?: string
  videoDuration?: number
  videoRatio?: string
  composeOutputs?: ComposeOutput[]
  composeSelectedKeys?: string[]
  composePipeline?: ComposePipeline
  composeBaConfigId?: string
  maxReached?: number
}

const STEPS = ['礼物上传', '提示词生成', '换肤结果', '资产合成'] as const
const STEP_KEYS = ['step1', 'step2', 'step3', 'step4'] as const
const RATIO_OPTIONS = [
  { label: '21:9', value: 21 / 9 },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
  { label: '3:4', value: 3 / 4 },
  { label: '9:16', value: 9 / 16 },
] as const

function clampDuration(duration: number) {
  return Math.max(4, Math.min(15, Math.round(duration)))
}

function nearestRatio(width: number, height: number) {
  const actual = width / height
  return RATIO_OPTIONS.reduce((best, item) =>
    Math.abs(item.value - actual) < Math.abs(best.value - actual) ? item : best,
  ).label
}

async function probeVideoMetadata(file: File): Promise<{ duration: number; ratio: string }> {
  return await new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = url

    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
    }

    const fallback = () => {
      cleanup()
      resolve({ duration: 10, ratio: '9:16' })
    }

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0
        ? clampDuration(video.duration)
        : 10
      const ratio = video.videoWidth > 0 && video.videoHeight > 0
        ? nearestRatio(video.videoWidth, video.videoHeight)
        : '9:16'
      cleanup()
      resolve({ duration, ratio })
    }

    video.onerror = fallback
  })
}

async function pollTask(
  taskId: string,
  onProgress: (pct: number) => void,
): Promise<Record<string, unknown>> {
  while (true) {
    await new Promise((r) => setTimeout(r, 2000))
    const res = await fetch(`/api/tasks/${taskId}`)
    if (!res.ok) throw new Error('轮询任务失败')
    const data = await res.json()
    const task = data.task
    if (task.progress != null) onProgress(task.progress)
    if (task.status === 'completed') return (task.result ?? {}) as Record<string, unknown>
    if (task.status === 'failed') throw new Error(task.errorMessage || '任务失败')
  }
}

export default function ReskinPage() {
  const searchParams = useSearchParams()
  const initialProjectId = searchParams?.get('projectId') ?? null

  const projectIdRef = useRef<string | null>(initialProjectId)
  const [projectLoaded, setProjectLoaded] = useState(!initialProjectId)

  const [step, setStep] = useState(0)
  const [maxReached, setMaxReached] = useState(0)

  const [videoUrl, setVideoUrl] = useState('')
  const [videoStorageKey, setVideoStorageKey] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageStorageKey, setImageStorageKey] = useState('')
  const [videoPrompt, setVideoPrompt] = useState('')
  const [resultVideoUrl, setResultVideoUrl] = useState('')
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [videoRatio, setVideoRatio] = useState<string | null>(null)
  const [baConfigs, setBaConfigs] = useState<ComposeBaConfigItem[]>([])
  const [composeOutputs, setComposeOutputs] = useState<ComposeOutput[]>([])
  const [composeSelectedKeys, setComposeSelectedKeys] = useState<string[]>([])
  const [composePipeline, setComposePipeline] = useState<ComposePipeline | null>(null)
  const [composeBaConfigId, setComposeBaConfigId] = useState('')

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [generateProgress, setGenerateProgress] = useState(0)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const latestStateRef = useRef<ReskinPersistedState>({})
  useEffect(() => {
    latestStateRef.current = {
      videoUrl,
      videoStorageKey,
      imageUrl,
      imageStorageKey,
      videoPrompt,
      resultVideoUrl,
      videoDuration: videoDuration ?? undefined,
      videoRatio: videoRatio ?? undefined,
      composeOutputs,
      composeSelectedKeys,
      composePipeline: composePipeline ?? undefined,
      composeBaConfigId: composeBaConfigId || undefined,
      maxReached,
    }
  }, [
    videoUrl,
    videoStorageKey,
    imageUrl,
    imageStorageKey,
    videoPrompt,
    resultVideoUrl,
    videoDuration,
    videoRatio,
    composeOutputs,
    composeSelectedKeys,
    composePipeline,
    composeBaConfigId,
    maxReached,
  ])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/ba-config')
        if (!res.ok || cancelled) return
        const data = await res.json()
        const configs = (data.configs || []) as ComposeBaConfigItem[]
        setBaConfigs(configs)
        if (!composeBaConfigId) {
          const fallback = configs.find((item) => item.isDefault)?.id || configs[0]?.id || ''
          if (fallback) setComposeBaConfigId(fallback)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [composeBaConfigId])

  useEffect(() => {
    if (!initialProjectId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/projects/${initialProjectId}`)
        if (!res.ok) {
          if (!cancelled) setProjectLoaded(true)
          return
        }
        const data = await res.json()
        const project = data.project
        const s = (project?.state || {}) as ReskinPersistedState
        if (cancelled) return
        if (s.videoUrl) setVideoUrl(s.videoUrl)
        if (s.videoStorageKey) setVideoStorageKey(s.videoStorageKey)
        if (s.imageUrl) setImageUrl(s.imageUrl)
        if (s.imageStorageKey) setImageStorageKey(s.imageStorageKey)
        if (s.videoPrompt) setVideoPrompt(s.videoPrompt)
        if (s.resultVideoUrl) setResultVideoUrl(s.resultVideoUrl)
        if (typeof s.videoDuration === 'number') setVideoDuration(s.videoDuration)
        if (typeof s.videoRatio === 'string') setVideoRatio(s.videoRatio)
        if (s.composeOutputs) setComposeOutputs(s.composeOutputs)
        if (s.composeSelectedKeys) setComposeSelectedKeys(s.composeSelectedKeys)
        if (s.composePipeline) setComposePipeline(s.composePipeline)
        if (s.composeBaConfigId) setComposeBaConfigId(s.composeBaConfigId)
        const stepIdx = STEP_KEYS.indexOf((project?.currentStep || 'step1') as (typeof STEP_KEYS)[number])
        const reached = typeof s.maxReached === 'number' ? s.maxReached : Math.max(0, stepIdx)
        setMaxReached(reached)
        setStep(Math.max(0, stepIdx))
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
    if (!resultVideoUrl) return
    if (composeSelectedKeys.length > 0) return
    const key = storageKeyFromFileUrl(resultVideoUrl)
    if (key) {
      setComposeSelectedKeys([key])
    }
  }, [composeSelectedKeys.length, resultVideoUrl])

  const ensureProject = useCallback(async (): Promise<string | null> => {
    if (projectIdRef.current) return projectIdRef.current
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'superpower',
          subKind: 'reskin',
          name: 'Untitled',
          state: latestStateRef.current,
          coverImageUrl: imageUrl || null,
          currentStep: 'step1',
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      const id: string | undefined = data.project?.id
      if (id) {
        projectIdRef.current = id
        try {
          const url = new URL(window.location.href)
          url.searchParams.set('projectId', id)
          window.history.replaceState(null, '', url.toString())
        } catch {
          /* ignore */
        }
        return id
      }
    } catch {
      /* ignore */
    }
    return null
  }, [imageUrl])

  const saveProject = useCallback(async (patch: { currentStep?: string; coverImageUrl?: string | null }) => {
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
        ...(imageUrl ? { coverImageUrl: imageUrl } : {}),
      })
    }, 800)
    return () => clearTimeout(handle)
  }, [
    step,
    imageUrl,
    resultVideoUrl,
    videoPrompt,
    videoUrl,
    videoStorageKey,
    imageStorageKey,
    videoDuration,
    videoRatio,
    composeOutputs,
    composeSelectedKeys,
    composePipeline,
    composeBaConfigId,
    maxReached,
    saveProject,
  ])

  const goToStep = useCallback((idx: number) => {
    if (idx <= maxReached) setStep(idx)
  }, [maxReached])

  const advanceTo = useCallback((idx: number) => {
    setStep(idx)
    setMaxReached((prev) => Math.max(prev, idx))
  }, [])

  const handleVideoFile = useCallback(async (file: File) => {
    if (!file.type.includes('mp4') && !file.name.toLowerCase().endsWith('.mp4')) {
      alert('仅支持 MP4 格式视频')
      return
    }
    setUploadingVideo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/video', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '视频上传失败')
      }
      const data = await res.json()
      setVideoUrl(data.videoUrl)
      setVideoStorageKey(data.storageKey)
      const metadata = await probeVideoMetadata(file)
      setVideoDuration(metadata.duration)
      setVideoRatio(metadata.ratio)
    } catch (err) {
      alert(err instanceof Error ? err.message : '视频上传失败')
    } finally {
      setUploadingVideo(false)
    }
  }, [])

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('仅支持图片文件')
      return
    }
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '图片上传失败')
      }
      const data = await res.json()
      setImageUrl(data.imageUrl)
      setImageStorageKey(data.storageKey)
    } catch (err) {
      alert(err instanceof Error ? err.message : '图片上传失败')
    } finally {
      setUploadingImage(false)
    }
  }, [])

  const handleRemoveVideo = useCallback(() => {
    setVideoUrl('')
    setVideoStorageKey('')
    setVideoDuration(null)
    setVideoRatio(null)
    setVideoPrompt('')
    setResultVideoUrl('')
    setComposeOutputs([])
    setComposeSelectedKeys([])
    setComposePipeline(null)
    setMaxReached(0)
    setStep(0)
  }, [])

  const handleRemoveImage = useCallback(() => {
    setImageUrl('')
    setImageStorageKey('')
    setVideoPrompt('')
    setResultVideoUrl('')
    setComposeOutputs([])
    setComposeSelectedKeys([])
    setComposePipeline(null)
    setMaxReached(0)
    setStep(0)
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!videoStorageKey || !imageStorageKey) return
    setAnalyzing(true)
    setAnalyzeProgress(0)
    try {
      await ensureProject()
      const res = await fetch('/api/reskin/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoStorageKey, imageStorageKey }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '提示词生成提交失败')
      }
      const { taskId } = await res.json()
      const result = await pollTask(taskId, setAnalyzeProgress)
      setVideoPrompt(result.video_prompt as string)
      advanceTo(1)
      latestStateRef.current = {
        ...latestStateRef.current,
        videoPrompt: result.video_prompt as string,
        maxReached: Math.max(1, latestStateRef.current.maxReached ?? 0),
      }
      saveProject({ currentStep: 'step2', coverImageUrl: imageUrl || null })
    } catch (err) {
      alert(err instanceof Error ? err.message : '提示词生成失败')
    } finally {
      setAnalyzing(false)
    }
  }, [videoStorageKey, imageStorageKey, ensureProject, advanceTo, saveProject, imageUrl])

  const handleGenerateVideo = useCallback(async () => {
    if (!videoPrompt.trim() || !imageUrl) return
    setGeneratingVideo(true)
    setGenerateProgress(0)
    try {
      await ensureProject()
      const res = await fetch('/api/fission/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoPrompt: videoPrompt.trim(),
          referenceImageUrls: [imageUrl],
          referenceVideoUrl: videoUrl,
          ratio: videoRatio ?? '9:16',
          duration: videoDuration ?? 10,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '视频生成提交失败')
      }
      const { taskId } = await res.json()
      const result = await pollTask(taskId, setGenerateProgress)
      setResultVideoUrl(result.videoUrl as string)
      advanceTo(2)
      latestStateRef.current = {
        ...latestStateRef.current,
        resultVideoUrl: result.videoUrl as string,
        maxReached: Math.max(2, latestStateRef.current.maxReached ?? 0),
      }
      saveProject({ currentStep: 'step3', coverImageUrl: imageUrl || null })
    } catch (err) {
      alert(err instanceof Error ? err.message : '视频生成失败')
    } finally {
      setGeneratingVideo(false)
    }
  }, [videoPrompt, imageUrl, videoUrl, videoRatio, videoDuration, ensureProject, advanceTo, saveProject])

  if (!projectLoaded) {
    return <div className="flex items-center justify-center py-24 text-body">正在加载项目...</div>
  }

  return (
    <>
      <div className="space-y-6">
        <SubPageHeader
          title="礼物换肤"
          steps={STEPS}
          current={step}
          maxReached={maxReached}
          onStepClick={goToStep}
        />

        {step === 0 && (
          <div className="space-y-6">
            <div className="text-left">
              <h2 className="text-h3">礼物上传</h2>
              <p className="mt-2 text-14px text-fg3">上传一个参考视频和一张参考图片，用于生成换肤提示词。</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <UploadBox
                title="参考视频"
                description="支持拖拽或点击上传 MP4 视频"
                active={!!videoUrl}
                onSelect={handleVideoFile}
                accept="video/mp4,.mp4"
                kind="video"
                hasFile={!!videoUrl}
                uploading={uploadingVideo}
                onRemove={handleRemoveVideo}
                previewSrc={videoUrl}
                previewAlt="参考视频"
              >
                {videoUrl && videoDuration && videoRatio && (
                  <p className="text-caption">时长 {videoDuration}s · 画幅 {videoRatio}</p>
                )}
              </UploadBox>

              <UploadBox
                title="参考图片"
                description="支持拖拽或点击上传图片"
                active={!!imageUrl}
                onSelect={handleImageFile}
                accept="image/*"
                kind="image"
                hasFile={!!imageUrl}
                uploading={uploadingImage}
                onRemove={handleRemoveImage}
                previewSrc={imageUrl}
                previewAlt="参考图片"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || !videoStorageKey || !imageStorageKey}
                className="btn-gradient"
              >
                提示词生成
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-left">
              <h2 className="text-h3">提示词生成</h2>
              <p className="mt-2 text-14px text-fg3">你可以继续编辑生成后的提示词，然后开始换肤。</p>
            </div>

            <div className="prompt-box relative p-2 pr-2">
              <textarea
                className="scrollbar-prompt min-h-[240px] w-full resize-none rounded-[var(--radius-card)] border-0 bg-transparent p-5 pb-16 text-body outline-none placeholder:text-fg3"
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder="这里会展示上一步生成的 video_prompt"
                disabled={generatingVideo}
              />
              {videoDuration && videoRatio && (
                <div className="pointer-events-none absolute inset-x-5 bottom-4 flex flex-wrap items-center gap-2 text-caption text-fg3">
                  <span>将按 {videoRatio} · {videoDuration}s 进行生成</span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerateVideo}
                disabled={generatingVideo || !videoPrompt.trim() || !imageUrl}
                className="btn-gradient"
              >
                开始换肤
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-left">
              <h2 className="text-h3">换肤结果</h2>
              <p className="mt-2 text-14px text-fg3">预览生成结果，并继续进入资产合成步骤。</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="content-card p-6">
                <p className="mb-4 text-h4">原视频</p>
                {videoUrl ? (
                  <PreviewableMedia
                    type="video"
                    src={videoUrl}
                    alt="原视频"
                    wrapperClassName="flex h-[500px] items-center justify-center"
                    className="h-[500px] w-auto max-w-full rounded-[var(--radius-card)] bg-black/40 object-contain"
                  />
                ) : (
                  <div className="flex h-[500px] items-center justify-center text-body text-fg3">
                    暂无原视频
                  </div>
                )}
              </div>

              <div className="content-card p-6">
                <p className="mb-4 text-h4">换肤视频</p>
                {resultVideoUrl ? (
                  <PreviewableMedia
                    type="video"
                    src={resultVideoUrl}
                    alt="换肤视频"
                    wrapperClassName="flex h-[500px] items-center justify-center"
                    className="h-[500px] w-auto max-w-full rounded-[var(--radius-card)] bg-black/40 object-contain"
                  />
                ) : (
                  <div className="flex h-[500px] items-center justify-center text-body text-fg3">
                    暂无换肤结果
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setComposeOutputs([])
                  advanceTo(3)
                }}
                disabled={!resultVideoUrl}
                className="btn-gradient"
              >
                资产合成
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <PostprocessComposeStep
            videos={resultVideoUrl ? [{
              key: storageKeyFromFileUrl(resultVideoUrl),
              label: '换肤视频',
              url: resultVideoUrl,
            }].filter((item) => item.key) : []}
            baConfigs={baConfigs}
            outputs={composeOutputs}
            onOutputsChange={setComposeOutputs}
            selectedKeys={composeSelectedKeys}
            onSelectedKeysChange={setComposeSelectedKeys}
            pipeline={composePipeline}
            onPipelineChange={setComposePipeline}
            baConfigId={composeBaConfigId}
            onBaConfigIdChange={setComposeBaConfigId}
          />
        )}
      </div>

      <GenerateProgressModal
        open={analyzing}
        title="提示词生成中"
        progress={analyzeProgress}
      />
      <GenerateProgressModal
        open={generatingVideo}
        title="视频生成中"
        progress={generateProgress}
      />
    </>
  )
}
