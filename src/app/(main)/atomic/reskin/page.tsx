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
import ReskinGiftPicker from '@/components/ui/ReskinGiftPicker'
import ReskinImageGenerateStep from '@/components/ui/ReskinImageGenerateStep'
import { storageKeyFromFileUrl } from '@/lib/storage/utils'
import { findGift } from '@/lib/reskin/gifts'

type ReskinPersistedState = {
  giftKey?: string
  themeKeyword?: string
  imagePromptText?: string
  generatedImageUrl?: string
  generatedImageStorageKey?: string
  videoPrompt?: string
  resultVideoUrl?: string
  composeOutputs?: ComposeOutput[]
  composeSelectedKeys?: string[]
  composePipeline?: ComposePipeline
  composeBaConfigId?: string
  maxReached?: number
}

const STEPS = ['礼物选择', '图像生成', '提示词生成', '换肤结果', '资产合成'] as const
const STEP_KEYS = ['step1', 'step2', 'step3', 'step4', 'step5'] as const

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

  // Step1 礼物选择
  const [giftKey, setGiftKey] = useState('')
  const [themeKeyword, setThemeKeyword] = useState('')

  // Step2 图像生成
  const [imagePromptText, setImagePromptText] = useState('')
  const [generatedImageUrl, setGeneratedImageUrl] = useState('')
  const [generatedImageStorageKey, setGeneratedImageStorageKey] = useState('')

  // Step3 提示词生成
  const [videoPrompt, setVideoPrompt] = useState('')

  // Step4 换肤结果
  const [resultVideoUrl, setResultVideoUrl] = useState('')

  // Step5 资产合成
  const [baConfigs, setBaConfigs] = useState<ComposeBaConfigItem[]>([])
  const [composeOutputs, setComposeOutputs] = useState<ComposeOutput[]>([])
  const [composeSelectedKeys, setComposeSelectedKeys] = useState<string[]>([])
  const [composePipeline, setComposePipeline] = useState<ComposePipeline | null>(null)
  const [composeBaConfigId, setComposeBaConfigId] = useState('')

  // Loading states
  const [analyzingImagePrompt, setAnalyzingImagePrompt] = useState(false)
  const [analyzeImagePromptProgress, setAnalyzeImagePromptProgress] = useState(0)
  const [analyzingVideoPrompt, setAnalyzingVideoPrompt] = useState(false)
  const [analyzeVideoPromptProgress, setAnalyzeVideoPromptProgress] = useState(0)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [generateVideoProgress, setGenerateVideoProgress] = useState(0)

  const latestStateRef = useRef<ReskinPersistedState>({})
  useEffect(() => {
    latestStateRef.current = {
      giftKey: giftKey || undefined,
      themeKeyword: themeKeyword || undefined,
      imagePromptText: imagePromptText || undefined,
      generatedImageUrl: generatedImageUrl || undefined,
      generatedImageStorageKey: generatedImageStorageKey || undefined,
      videoPrompt: videoPrompt || undefined,
      resultVideoUrl: resultVideoUrl || undefined,
      composeOutputs,
      composeSelectedKeys,
      composePipeline: composePipeline ?? undefined,
      composeBaConfigId: composeBaConfigId || undefined,
      maxReached,
    }
  }, [
    giftKey,
    themeKeyword,
    imagePromptText,
    generatedImageUrl,
    generatedImageStorageKey,
    videoPrompt,
    resultVideoUrl,
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
    return () => { cancelled = true }
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

        // v1 project compat: no giftKey means old 4-step format, reset silently
        if (!s.giftKey) {
          if (!cancelled) setProjectLoaded(true)
          return
        }

        if (s.giftKey) setGiftKey(s.giftKey)
        if (s.themeKeyword) setThemeKeyword(s.themeKeyword)
        if (s.imagePromptText) setImagePromptText(s.imagePromptText)
        if (s.generatedImageUrl) setGeneratedImageUrl(s.generatedImageUrl)
        if (s.generatedImageStorageKey) setGeneratedImageStorageKey(s.generatedImageStorageKey)
        if (s.videoPrompt) setVideoPrompt(s.videoPrompt)
        if (s.resultVideoUrl) setResultVideoUrl(s.resultVideoUrl)
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
    return () => { cancelled = true }
  }, [initialProjectId])

  useEffect(() => {
    if (!resultVideoUrl) return
    if (composeSelectedKeys.length > 0) return
    const key = storageKeyFromFileUrl(resultVideoUrl)
    if (key) setComposeSelectedKeys([key])
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
          coverImageUrl: generatedImageUrl || null,
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
  }, [generatedImageUrl])

  const saveProject = useCallback(async (patch: { currentStep?: string; coverImageUrl?: string | null }) => {
    const id = projectIdRef.current
    if (!id) return
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, state: latestStateRef.current }),
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
        ...(generatedImageUrl ? { coverImageUrl: generatedImageUrl } : {}),
      })
    }, 800)
    return () => clearTimeout(handle)
  }, [
    step,
    giftKey,
    themeKeyword,
    imagePromptText,
    generatedImageUrl,
    generatedImageStorageKey,
    videoPrompt,
    resultVideoUrl,
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

  // Step1 → Step2：生成图像提示词
  const handleGenerateImagePrompt = useCallback(async () => {
    if (!giftKey || !themeKeyword.trim()) return
    setAnalyzingImagePrompt(true)
    setAnalyzeImagePromptProgress(0)
    try {
      await ensureProject()
      const res = await fetch('/api/reskin/generate-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftKey, themeKeyword: themeKeyword.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message || '图像提示词生成失败')
      }
      const { taskId } = await res.json()
      const result = await pollTask(taskId, setAnalyzeImagePromptProgress)
      const prompt = result.imagePrompt as string
      setImagePromptText(prompt)
      advanceTo(1)
      latestStateRef.current = {
        ...latestStateRef.current,
        imagePromptText: prompt,
        maxReached: Math.max(1, latestStateRef.current.maxReached ?? 0),
      }
      saveProject({ currentStep: 'step2' })
    } catch (err) {
      alert(err instanceof Error ? err.message : '图像提示词生成失败')
    } finally {
      setAnalyzingImagePrompt(false)
    }
  }, [giftKey, themeKeyword, ensureProject, advanceTo, saveProject])

  // Step2 → Step3：分析视频提示词
  const handleAnalyzeVideoPrompt = useCallback(async () => {
    if (!giftKey || !generatedImageStorageKey) return
    setAnalyzingVideoPrompt(true)
    setAnalyzeVideoPromptProgress(0)
    try {
      await ensureProject()
      const res = await fetch('/api/reskin/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftKey, imageStorageKey: generatedImageStorageKey }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message || '提示词生成提交失败')
      }
      const { taskId } = await res.json()
      const result = await pollTask(taskId, setAnalyzeVideoPromptProgress)
      const vp = result.video_prompt as string
      setVideoPrompt(vp)
      advanceTo(2)
      latestStateRef.current = {
        ...latestStateRef.current,
        videoPrompt: vp,
        maxReached: Math.max(2, latestStateRef.current.maxReached ?? 0),
      }
      saveProject({ currentStep: 'step3', coverImageUrl: generatedImageUrl || null })
    } catch (err) {
      alert(err instanceof Error ? err.message : '提示词生成失败')
    } finally {
      setAnalyzingVideoPrompt(false)
    }
  }, [giftKey, generatedImageStorageKey, ensureProject, advanceTo, saveProject, generatedImageUrl])

  // Step3 → Step4：换肤（生成视频）
  const handleGenerateVideo = useCallback(async () => {
    if (!videoPrompt.trim() || !generatedImageUrl || !giftKey) return
    const gift = findGift(giftKey)
    if (!gift) return
    setGeneratingVideo(true)
    setGenerateVideoProgress(0)
    try {
      await ensureProject()
      const res = await fetch('/api/fission/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoPrompt: videoPrompt.trim(),
          referenceImageUrls: [generatedImageUrl],
          referenceVideoUrl: gift.videoUrl,
          ratio: gift.ratio,
          duration: gift.duration,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message || '视频生成提交失败')
      }
      const { taskId } = await res.json()
      const result = await pollTask(taskId, setGenerateVideoProgress)
      const vUrl = result.videoUrl as string
      setResultVideoUrl(vUrl)
      advanceTo(3)
      latestStateRef.current = {
        ...latestStateRef.current,
        resultVideoUrl: vUrl,
        maxReached: Math.max(3, latestStateRef.current.maxReached ?? 0),
      }
      saveProject({ currentStep: 'step4', coverImageUrl: generatedImageUrl || null })
    } catch (err) {
      alert(err instanceof Error ? err.message : '视频生成失败')
    } finally {
      setGeneratingVideo(false)
    }
  }, [videoPrompt, generatedImageUrl, giftKey, ensureProject, advanceTo, saveProject])

  if (!projectLoaded) {
    return <div className="flex items-center justify-center py-24 text-body">正在加载项目...</div>
  }

  const currentGift = giftKey ? findGift(giftKey) : null

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

        {/* Step1：礼物选择 */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-left">
              <h2 className="text-h3">礼物选择</h2>
              <p className="mt-2 text-14px text-fg3">选择一个礼物，并输入换肤主题，系统将自动生成图像提示词。</p>
            </div>

            <ReskinGiftPicker
              selectedKey={giftKey}
              onSelect={setGiftKey}
              themeKeyword={themeKeyword}
              onThemeChange={setThemeKeyword}
              disabled={analyzingImagePrompt}
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerateImagePrompt}
                disabled={analyzingImagePrompt || !giftKey || !themeKeyword.trim()}
                className="btn-gradient"
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {/* Step2：图像生成 */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-left">
              <h2 className="text-h3">图像生成</h2>
              <p className="mt-2 text-14px text-fg3">
                基于生成的提示词生成换肤图像，也可以上传或编辑图像后继续。
              </p>
            </div>

            <ReskinImageGenerateStep
              imageUrl={generatedImageUrl}
              imageStorageKey={generatedImageStorageKey}
              promptText={imagePromptText}
              onPromptChange={setImagePromptText}
              onImageChange={(url, key) => {
                setGeneratedImageUrl(url)
                setGeneratedImageStorageKey(key)
              }}
              greenImageUrl={currentGift?.greenImage ?? ''}
              onSubmit={handleAnalyzeVideoPrompt}
              submitting={analyzingVideoPrompt}
              disabled={analyzingVideoPrompt}
            />
          </div>
        )}

        {/* Step3：提示词生成 */}
        {step === 2 && (
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
              {currentGift && (
                <div className="pointer-events-none absolute inset-x-5 bottom-4 flex flex-wrap items-center gap-2 text-caption text-fg3">
                  <span>将按 {currentGift.ratio} · {currentGift.duration}s 进行生成</span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerateVideo}
                disabled={generatingVideo || !videoPrompt.trim() || !generatedImageUrl || !giftKey}
                className="btn-gradient"
              >
                开始换肤
              </button>
            </div>
          </div>
        )}

        {/* Step4：换肤结果 */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-left">
              <h2 className="text-h3">换肤结果</h2>
              <p className="mt-2 text-14px text-fg3">预览生成结果，并继续进入资产合成步骤。</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="content-card p-6">
                <p className="mb-4 text-h4">原视频</p>
                {currentGift?.videoUrl ? (
                  <PreviewableMedia
                    type="video"
                    src={currentGift.videoUrl}
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
                  advanceTo(4)
                }}
                disabled={!resultVideoUrl}
                className="btn-gradient"
              >
                资产合成
              </button>
            </div>
          </div>
        )}

        {/* Step5：资产合成 */}
        {step === 4 && (
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
        open={analyzingImagePrompt}
        title="图像提示词生成中"
        progress={analyzeImagePromptProgress}
      />
      <GenerateProgressModal
        open={analyzingVideoPrompt}
        title="提示词生成中"
        progress={analyzeVideoPromptProgress}
      />
      <GenerateProgressModal
        open={generatingVideo}
        title="视频生成中"
        progress={generateVideoProgress}
      />
    </>
  )
}
