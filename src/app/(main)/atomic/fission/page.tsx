'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import PostprocessComposeStep, {
  type ComposeBaConfigItem,
  type ComposeOutput,
  type ComposePipeline,
} from '@/components/ui/PostprocessComposeStep'
import SubPageHeader from '@/components/ui/SubPageHeader'
import UploadBox from '@/components/ui/UploadBox'
import ImageEditModal from '@/components/ui/ImageEditModal'
import Dropdown from '@/components/ui/Dropdown'
import GenerateProgressModal from '@/components/ui/GenerateProgressModal'
import MediaFrame from '@/components/ui/MediaFrame'
import PreviewableMedia from '@/components/ui/PreviewableMedia'
import { storageKeyFromFileUrl } from '@/lib/storage/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnalysisAsset = Record<string, unknown>

type ThemeProfile = {
  world_type?: string
  space_device_type?: string
  material_system?: string
  mood?: string
}

type MappingAsset = {
  element_mappings?: Array<Record<string, unknown>>
  dependency_mappings?: Array<Record<string, unknown>>
  color_strategy?: {
    primary?: string
    secondary?: string
    accent?: string
  }
}

type Theme = {
  theme_id?: string
  theme_source: 'recommendation' | 'user_input'
  title: string
  description: string
  visual?: string
  theme_profile?: ThemeProfile
  mapping_asset?: MappingAsset
  raw_theme_input?: string
}

type CharacterEntry = {
  group_id: number
  group_label?: string
  character_id?: string
  character_name: string
  role_type?: string
  image_prompt: string
  imageUrl?: string
}

type ThemeCharacters = {
  themeTitle: string
  themeIndex: number
  selectedTheme?: Theme
  characters: CharacterEntry[]
}

type GroupVideoPrompt = {
  group_id: number
  video_prompt: string
  videoUrl?: string
}

type ThemeVideoPrompts = {
  themeTitle: string
  themeIndex: number
  selectedTheme?: Theme
  prompts: GroupVideoPrompt[]
}

type ActiveProgress = {
  open: boolean
  title: string
  statusText?: string
  progress?: number
  showProgressBar?: boolean
}

type ActiveProgressSetter = (next: ActiveProgress) => void

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = ['上传视频', '选择主题', '素材生成', '视频生成', '资产合成'] as const

// ---------------------------------------------------------------------------
// Poll helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Step 1: Upload Video
// ---------------------------------------------------------------------------

function UploadVideoStep({
  videoUrl, setVideoUrl, storageKey, setStorageKey,
  setVideoDuration, setVideoRatio,
  onRemove,
  onAnalyze, analyzing, progress,
}: {
  videoUrl: string; setVideoUrl: (v: string) => void
  storageKey: string; setStorageKey: (v: string) => void
  setVideoDuration: (v: number) => void
  setVideoRatio: (v: string) => void
  onRemove: () => void
  onAnalyze: () => void; analyzing: boolean; progress: number
}) {
  const [uploading, setUploading] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.includes('mp4') && !file.name.toLowerCase().endsWith('.mp4')) {
      alert('仅支持 MP4 格式视频')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/video', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '上传失败')
      }
      const data = await res.json()
      setVideoUrl(data.videoUrl)
      setStorageKey(data.storageKey)
      const meta = await probeVideoMetadata(file)
      setVideoDuration(meta.duration)
      setVideoRatio(meta.ratio)
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }, [setVideoDuration, setVideoRatio, setVideoUrl, setStorageKey])

  return (
    <div className="mt-6">
      <div className="mb-5 text-left">
        <h3 className="text-h3">上传视频</h3>
        <p className="mt-2 text-14px text-fg3">上传一个参考视频，用于生成裂变主题与后续素材。</p>
      </div>

      <UploadBox
        title="参考视频"
        description="支持拖拽或点击上传 MP4 视频"
        accept="video/mp4,.mp4"
        active={!!videoUrl}
        onSelect={handleFile}
        hasFile={!!videoUrl}
        uploading={uploading}
        onRemove={onRemove}
        previewSrc={videoUrl}
        previewAlt="参考视频"
      />

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing || !storageKey}
          className="btn-gradient"
        >
          {analyzing ? `分析中 ${progress}%` : '开始分析'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Select Themes
// ---------------------------------------------------------------------------

function SelectThemesStep({
  themes, selectedIndices, toggleTheme,
  themeTab, setThemeTab,
  customThemePrompt, setCustomThemePrompt,
  onGenerate, generating, progress,
  onRegenerate, regenerating, regenProgress,
}: {
  themes: Theme[]
  selectedIndices: Set<number>
  toggleTheme: (idx: number) => void
  themeTab: 'recommend' | 'custom'
  setThemeTab: (tab: 'recommend' | 'custom') => void
  customThemePrompt: string
  setCustomThemePrompt: (v: string) => void
  onGenerate: () => void
  generating: boolean
  progress: number
  onRegenerate: () => void
  regenerating: boolean
  regenProgress: number
}) {
  const generateDisabled = generating || regenerating || (
    themeTab === 'recommend'
      ? selectedIndices.size === 0
      : customThemePrompt.trim().length === 0
  )
  const regenerateDisabled = regenerating || generating

  return (
    <div className="mt-6">
      {/* Sub tabs */}
      <div className="mb-6 flex items-center gap-6">
        <button
          type="button"
          onClick={() => setThemeTab('recommend')}
          className={`text-14px transition-colors ${
            themeTab === 'recommend' ? 'text-white' : 'text-white/50 hover:text-white/80'
          }`}
        >
          选择裂变主题
        </button>
        <button
          type="button"
          onClick={() => setThemeTab('custom')}
          className={`text-14px transition-colors ${
            themeTab === 'custom' ? 'text-white' : 'text-white/50 hover:text-white/80'
          }`}
        >
          自定义裂变主题
        </button>
      </div>

      {themeTab === 'recommend' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {themes.map((t, idx) => {
            const selected = selectedIndices.has(idx)
            return (
              <button
                type="button"
                key={t.theme_id ?? idx}
                onClick={() => toggleTheme(idx)}
                className={`content-card p-5 text-left ${
                  selected
                    ? 'border-[color:var(--color-brand-2)]/70 bg-[color:var(--color-brand-2)]/8'
                    : ''
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                      selected ? 'bg-gradient-brand text-fg' : 'bg-white/10 text-fg3'
                    }`}
                  >
                    {selected ? '✓' : idx + 1}
                  </span>
                  <h4 className="text-h4">{t.title}</h4>
                </div>
                <p className="text-body">{t.description}</p>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="prompt-box p-2 pr-2">
          <textarea
            className="scrollbar-prompt min-h-[220px] w-full resize-none rounded-[var(--radius-card)] border-0 bg-transparent p-5 text-body outline-none placeholder:text-fg3"
            placeholder="简单输入主题关键词，例如：'赛博花园'"
            value={customThemePrompt}
            onChange={(e) => setCustomThemePrompt(e.target.value)}
            disabled={generating || regenerating}
          />
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        {themeTab === 'recommend' ? (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerateDisabled}
            className="btn-alt"
          >
            {regenerating ? `重新生成 ${regenProgress}%` : '重新生成'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onGenerate}
          disabled={generateDisabled}
          className="btn-gradient"
        >
          {generating ? `生成中 ${progress}%` : '生成素材'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Asset Board
// ---------------------------------------------------------------------------

function AssetBoardStep({
  themeCharacters, setThemeCharacters,
  onGenerateVideoPrompts, generating, progress,
  setActiveProgress, closeProgress,
}: {
  themeCharacters: ThemeCharacters[]
  setThemeCharacters: (v: ThemeCharacters[]) => void
  onGenerateVideoPrompts: () => void
  generating: boolean
  progress: number
  setActiveProgress: ActiveProgressSetter
  closeProgress: () => void
}) {
  const [activeTheme, setActiveTheme] = useState(0)
  const [editModal, setEditModal] = useState<{ themeIdx: number; charIdx: number } | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [charGenerating, setCharGenerating] = useState<Record<string, boolean>>({})

  const handleGenerateCharImage = useCallback(async (themeIdx: number, charIdx: number, char: CharacterEntry) => {
    const key = `${themeIdx}-${charIdx}`
    const title = (char.character_name || '').trim()
    const body = (char.image_prompt || '').trim()
    const composedPrompt = title ? `${title}\n${body}` : body
    setCharGenerating((p) => ({ ...p, [key]: true }))
    setActiveProgress({ open: true, title: '角色图生成中', statusText: '提交中...', showProgressBar: false })
    try {
      const res = await fetch('/api/fission/generate-character-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: composedPrompt }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '提交失败')
      }
      const { taskId } = await res.json()
      const result = await pollTask(taskId, (pct) => {
        setActiveProgress({ open: true, title: '角色图生成中', progress: pct, showProgressBar: true })
      })
      setThemeCharacters(themeCharacters.map((tc, ti) =>
        ti === themeIdx ? {
          ...tc,
          characters: tc.characters.map((c, ci) => ci === charIdx ? { ...c, imageUrl: result.imageUrl as string } : c),
        } : tc,
      ))
    } catch (err) {
      alert(err instanceof Error ? err.message : '生成失败')
    } finally {
      setCharGenerating((p) => ({ ...p, [key]: false }))
      closeProgress()
    }
  }, [themeCharacters, setThemeCharacters, setActiveProgress, closeProgress])

  const updateCharacter = useCallback((themeIdx: number, charIdx: number, patch: Partial<CharacterEntry>) => {
    setThemeCharacters(themeCharacters.map((tc, ti) =>
      ti === themeIdx ? {
        ...tc,
        characters: tc.characters.map((c, ci) => ci === charIdx ? { ...c, ...patch } : c),
      } : tc,
    ))
  }, [themeCharacters, setThemeCharacters])

  const deleteCharacter = useCallback((themeIdx: number, charIdx: number) => {
    setThemeCharacters(themeCharacters.map((tc, ti) =>
      ti === themeIdx ? { ...tc, characters: tc.characters.filter((_, ci) => ci !== charIdx) } : tc,
    ))
  }, [themeCharacters, setThemeCharacters])

  const deleteGroup = useCallback((themeIdx: number, groupId: number) => {
    setThemeCharacters(themeCharacters.map((tc, ti) =>
      ti === themeIdx ? { ...tc, characters: tc.characters.filter((c) => c.group_id !== groupId) } : tc,
    ))
  }, [themeCharacters, setThemeCharacters])

  const deleteTheme = useCallback((themeIdx: number) => {
    const next = themeCharacters.filter((_, i) => i !== themeIdx)
    setThemeCharacters(next)
    if (activeTheme >= next.length) setActiveTheme(Math.max(0, next.length - 1))
  }, [themeCharacters, setThemeCharacters, activeTheme])

  const handleUploadImage = useCallback(async (themeIdx: number, charIdx: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) return
    const data = await res.json()
    updateCharacter(themeIdx, charIdx, { imageUrl: data.imageUrl })
  }, [updateCharacter])

  if (themeCharacters.length === 0) {
    return <p className="mt-6 text-12px text-white/20">暂无素材数据</p>
  }

  const current = themeCharacters[activeTheme]
  const groups = new Map<number, CharacterEntry[]>()
  for (const c of current?.characters || []) {
    const arr = groups.get(c.group_id) || []
    arr.push(c)
    groups.set(c.group_id, arr)
  }

  return (
    <div className="mt-6">
      {/* Theme tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {themeCharacters.map((tc, ti) => (
          <div key={ti} className="btn-tab pl-5 pr-3" data-active={ti === activeTheme ? 'true' : 'false'}>
            <button
              type="button"
              onClick={() => setActiveTheme(ti)}
              className="min-w-0 flex-1 truncate text-left"
            >
              {tc.themeTitle}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                deleteTheme(ti)
              }}
              className="ml-1 shrink-0 text-caption text-fg3 transition hover:text-white hover:cursor-pointer"
              aria-label={`删除主题 ${tc.themeTitle}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Groups */}
      {Array.from(groups.entries()).map(([groupId, chars]) => {
        const groupCharBaseIdx = current.characters.findIndex((c) => c.group_id === groupId)
        return (
          <div key={groupId} className="content-card mb-6 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-h4">组 {groupId}</h4>
              <button
                type="button"
                onClick={() => deleteGroup(activeTheme, groupId)}
                className="text-[12px] text-white/50 transition hover:text-white/75 hover:cursor-pointer"
              >
                删除组
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {chars.map((ch, ci) => {
                const globalIdx = groupCharBaseIdx + ci
                const refKey = `${activeTheme}-${globalIdx}`
                return (
                  <div key={ci} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-body text-fg">{ch.character_name}</span>
                      <button
                        type="button"
                        onClick={() => deleteCharacter(activeTheme, globalIdx)}
                        className="flex h-7 shrink-0 items-center justify-center px-2.5 text-[12px] text-white/50 transition hover:text-white/75 hover:cursor-pointer"
                      >
                        删除角色
                      </button>
                    </div>

                    <MediaFrame
                      type="image"
                      src={ch.imageUrl}
                      alt={ch.character_name}
                      aspectClassName="aspect-square"
                      containerClassName="mb-2"
                      emptyState={(
                        <button
                          type="button"
                          onClick={() => fileRefs.current[refKey]?.click()}
                          className="flex h-full w-full items-center justify-center text-caption text-fg3 hover:text-fg2"
                        >
                          点击上传
                        </button>
                      )}
                    >
                      {ch.imageUrl ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            updateCharacter(activeTheme, globalIdx, { imageUrl: undefined })
                          }}
                          className="absolute right-2 top-3 z-[2] flex h-7 w-7 items-center justify-center rounded-full border border-white/18 bg-white/4 text-[12px] text-white/85 transition hover:border-white/50 hover:bg-white/8 hover:text-white/50 hover:cursor-pointer"
                        >
                          ✕
                        </button>
                      ) : null}
                      <input ref={(el) => { fileRefs.current[refKey] = el }} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadImage(activeTheme, globalIdx, f) }} />
                    </MediaFrame>

                    <div className="inbox-prompt-box p-0 pr-2">
                      <textarea
                        className="scrollbar-prompt min-h-[60px] w-full resize-none rounded-[var(--radius-card)] border-0 bg-transparent p-4 text-caption outline-none placeholder:text-fg3"
                        value={ch.image_prompt}
                        onChange={(e) => updateCharacter(activeTheme, globalIdx, { image_prompt: e.target.value })}
                      />
                    </div>

                    <div className="mt-3 flex gap-2">
                      {ch.imageUrl ? (
                        <button
                          type="button"
                          onClick={() => setEditModal({ themeIdx: activeTheme, charIdx: globalIdx })}
                          className="btn-secondary-pill !h-8 flex-1 !px-3"
                        >
                          编辑图片
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileRefs.current[refKey]?.click()}
                          className="btn-secondary-pill !h-8 flex-1 !px-3"
                        >
                          上传图片
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleGenerateCharImage(activeTheme, globalIdx, ch)}
                        disabled={charGenerating[`${activeTheme}-${globalIdx}`] || !ch.image_prompt.trim()}
                        className="btn-secondary-pill !h-8 flex-1 !px-3 !text-caption"
                      >
                        {charGenerating[`${activeTheme}-${globalIdx}`] ? '生成中...' : ch.imageUrl ? '重新生成' : '生成图片'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Generate video prompts */}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onGenerateVideoPrompts}
          disabled={generating}
          className="btn-gradient"
        >
          {generating ? `生成中 ${progress}%` : '生成视频'}
        </button>
      </div>

      {/* Edit image modal */}
      <ImageEditModal
        open={!!editModal}
        imageUrl={editModal ? themeCharacters[editModal.themeIdx]?.characters[editModal.charIdx]?.imageUrl ?? '' : ''}
        onClose={() => setEditModal(null)}
        onConfirm={({ imageUrl: url }) => {
          if (editModal) {
            updateCharacter(editModal.themeIdx, editModal.charIdx, { imageUrl: url })
          }
          setEditModal(null)
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: Video Board
// ---------------------------------------------------------------------------

function VideoBoardStep({
  themeVideoPrompts, setThemeVideoPrompts,
  themeCharacters, setThemeCharacters,
  setActiveProgress, closeProgress,
  onCompose,
  videoRatio,
  videoDuration,
}: {
  themeVideoPrompts: ThemeVideoPrompts[]
  setThemeVideoPrompts: (v: ThemeVideoPrompts[]) => void
  themeCharacters: ThemeCharacters[]
  setThemeCharacters: (v: ThemeCharacters[]) => void
  setActiveProgress: ActiveProgressSetter
  closeProgress: () => void
  onCompose: () => void
  videoRatio: string | null
  videoDuration: number | null
}) {
  const [activeTheme, setActiveTheme] = useState(0)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [videoGenerating, setVideoGenerating] = useState<Record<string, boolean>>({})
  const [videoProgress, setVideoProgress] = useState<Record<string, string>>({})

  const updatePrompt = useCallback((themeIdx: number, promptIdx: number, patch: Partial<GroupVideoPrompt>) => {
    setThemeVideoPrompts(themeVideoPrompts.map((tv, ti) =>
      ti === themeIdx ? {
        ...tv,
        prompts: tv.prompts.map((p, pi) => pi === promptIdx ? { ...p, ...patch } : p),
      } : tv,
    ))
  }, [themeVideoPrompts, setThemeVideoPrompts])

  const deleteTheme = useCallback((themeTitle: string) => {
    const nextVideoPrompts = themeVideoPrompts.filter((tv) => tv.themeTitle !== themeTitle)
    const nextThemeCharacters = themeCharacters.filter((tc) => tc.themeTitle !== themeTitle)
    const nextVisibleCount = nextVideoPrompts.filter((tv) =>
      nextThemeCharacters.some((tc) => tc.themeTitle === tv.themeTitle),
    ).length

    setThemeVideoPrompts(nextVideoPrompts)
    setThemeCharacters(nextThemeCharacters)
    setActiveTheme((prev) => Math.min(prev, Math.max(0, nextVisibleCount - 1)))
  }, [themeCharacters, themeVideoPrompts, setThemeCharacters, setThemeVideoPrompts])

  const deleteGroup = useCallback((themeTitle: string, groupId: number) => {
    setThemeVideoPrompts(themeVideoPrompts.map((tv) =>
      tv.themeTitle === themeTitle
        ? { ...tv, prompts: tv.prompts.filter((gp) => gp.group_id !== groupId) }
        : tv,
    ))
    setThemeCharacters(themeCharacters.map((tc) =>
      tc.themeTitle === themeTitle
        ? { ...tc, characters: tc.characters.filter((c) => c.group_id !== groupId) }
        : tc,
    ))
  }, [themeCharacters, themeVideoPrompts, setThemeCharacters, setThemeVideoPrompts])

  const deleteCharacter = useCallback((themeTitle: string, charIdx: number) => {
    setThemeCharacters(themeCharacters.map((tc) =>
      tc.themeTitle === themeTitle
        ? { ...tc, characters: tc.characters.filter((_, ci) => ci !== charIdx) }
        : tc,
    ))
  }, [themeCharacters, setThemeCharacters])

  const handleGenerateVideo = useCallback(async (themeIdx: number, promptIdx: number, gp: GroupVideoPrompt) => {
    const key = `${themeIdx}-${gp.group_id}`
    const themeTitle = themeVideoPrompts[themeIdx]?.themeTitle ?? ''
    const modalTitle = themeTitle ? `${themeTitle} · 组${gp.group_id} 视频生成中` : '视频生成中'
    setVideoGenerating((p) => ({ ...p, [key]: true }))
    setVideoProgress((p) => ({ ...p, [key]: '提交中...' }))
    setActiveProgress({ open: true, title: modalTitle, statusText: '提交中...', showProgressBar: false })
    try {
      const charTheme = themeCharacters.find((tc) =>
        tc.themeTitle === themeVideoPrompts[themeIdx]?.themeTitle,
      )
      const refUrls = (charTheme?.characters || [])
        .filter((c) => c.group_id === gp.group_id && c.imageUrl)
        .map((c) => c.imageUrl!)

      const res = await fetch('/api/fission/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoPrompt: gp.video_prompt,
          referenceImageUrls: refUrls,
          ratio: videoRatio ?? '9:16',
          duration: videoDuration ?? 10,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '提交失败')
      }
      const { taskId } = await res.json()

      const result = await pollTask(taskId, (pct) => {
        setVideoProgress((p) => ({ ...p, [key]: `${pct}%` }))
        setActiveProgress({ open: true, title: modalTitle, progress: pct, showProgressBar: true })
      })

      updatePrompt(themeIdx, promptIdx, { videoUrl: result.videoUrl as string })
      setVideoProgress((p) => ({ ...p, [key]: '完成' }))
    } catch (err) {
      alert(err instanceof Error ? err.message : '视频生成失败')
      setVideoProgress((p) => ({ ...p, [key]: '' }))
    } finally {
      setVideoGenerating((p) => ({ ...p, [key]: false }))
      closeProgress()
    }
  }, [themeVideoPrompts, themeCharacters, updatePrompt, videoRatio, videoDuration, setActiveProgress, closeProgress])

  const charThemeTitles = new Set(themeCharacters.map((tc) => tc.themeTitle))
  const filteredEntries = themeVideoPrompts
    .map((tv, origIdx) => ({ tv, origIdx }))
    .filter(({ tv }) => charThemeTitles.has(tv.themeTitle))

  if (filteredEntries.length === 0) {
    return <p className="mt-6 text-12px text-white/20">暂无视频提示词数据</p>
  }

  const safeActiveTheme = Math.min(activeTheme, filteredEntries.length - 1)
  const { tv: current, origIdx: realThemeIdx } = filteredEntries[safeActiveTheme]
  const currentChars = themeCharacters.find((tc) => tc.themeTitle === current.themeTitle)

  const realCharThemeIdx = themeCharacters.findIndex((tc) => tc.themeTitle === current.themeTitle)
  const filteredPrompts = (current?.prompts ?? []).map((gp, origPi) => ({ gp, origPi }))

  return (
    <div className="mt-6">
      {/* Theme tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {filteredEntries.map(({ tv }, ti) => (
          <div key={ti} className="btn-tab pl-5 pr-3" data-active={ti === safeActiveTheme ? 'true' : 'false'}>
            <button
              type="button"
              onClick={() => setActiveTheme(ti)}
              className="min-w-0 flex-1 truncate text-left"
            >
              {tv.themeTitle}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                deleteTheme(tv.themeTitle)
              }}
              className="ml-1 shrink-0 text-caption text-fg3 transition hover:text-white hover:cursor-pointer"
              aria-label={`删除主题 ${tv.themeTitle}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Groups */}
      {filteredPrompts.map(({ gp, origPi }) => {
        const groupChars = currentChars?.characters.filter((c) => c.group_id === gp.group_id) || []
        return (
          <div key={gp.group_id} className="content-card mb-6 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-h4">组 {gp.group_id}</h4>
              <button
                type="button"
                onClick={() => deleteGroup(current.themeTitle, gp.group_id)}
                className="text-[12px] text-white/50 transition hover:text-white/75 hover:cursor-pointer"
              >
                删除组
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="flex h-[500px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
                {gp.videoUrl ? (
                  <PreviewableMedia
                    type="video"
                    src={gp.videoUrl}
                    alt={`组 ${gp.group_id} 视频`}
                    wrapperClassName="flex h-full w-full items-center justify-center"
                    className="h-full w-auto max-w-full object-contain"
                  />
                ) : (
                  <span className="text-body text-fg3">资源不可用</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {groupChars.map((ch, ci) => {
                  const refKey = `v-${activeTheme}-${gp.group_id}-${ci}`
                  const charGlobalIdx = currentChars?.characters.indexOf(ch) ?? -1
                  return (
                    <div key={ci} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-body text-fg">{ch.character_name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (charGlobalIdx < 0) return
                            deleteCharacter(current.themeTitle, charGlobalIdx)
                          }}
                          className="flex h-7 shrink-0 items-center justify-center px-2.5 text-[12px] text-white/50 transition hover:text-white/75 hover:cursor-pointer"
                        >
                          删除角色
                        </button>
                      </div>
                      <MediaFrame
                        type="image"
                        src={ch.imageUrl}
                        alt={ch.character_name}
                        aspectClassName="aspect-square"
                        containerClassName="mb-2"
                        emptyState={(
                          <button
                            type="button"
                            onClick={() => fileRefs.current[refKey]?.click()}
                            className="flex h-full w-full items-center justify-center text-caption text-fg3 hover:text-fg2"
                          >
                            上传
                          </button>
                        )}
                      >
                        {ch.imageUrl ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              if (charGlobalIdx < 0 || realCharThemeIdx < 0) return
                              setThemeCharacters(themeCharacters.map((tc, ti) =>
                                ti === realCharThemeIdx ? {
                                  ...tc,
                                  characters: tc.characters.map((c, i) => i === charGlobalIdx ? { ...c, imageUrl: undefined } : c),
                                } : tc,
                              ))
                            }}
                            className="absolute right-2 top-3 z-[2] flex h-7 w-7 items-center justify-center rounded-full border border-white/18 bg-white/4 text-[12px] text-white/85 transition hover:border-white/50 hover:bg-white/8 hover:text-white/50 hover:cursor-pointer"
                          >
                            ✕
                          </button>
                        ) : null}
                        <input ref={(el) => { fileRefs.current[refKey] = el }} type="file" accept="image/*" className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0]
                            if (!f || charGlobalIdx < 0) return
                            const fd = new FormData(); fd.append('file', f)
                            const res = await fetch('/api/upload', { method: 'POST', body: fd })
                            if (res.ok) {
                              const data = await res.json()
                              setThemeCharacters(themeCharacters.map((tc, ti) =>
                                ti === realCharThemeIdx ? {
                                  ...tc,
                                  characters: tc.characters.map((c, i) => i === charGlobalIdx ? { ...c, imageUrl: data.imageUrl } : c),
                                } : tc,
                              ))
                            }
                          }} />
                      </MediaFrame>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="inbox-prompt-box p-0 pr-2">
              <textarea
                className="scrollbar-prompt min-h-[80px] w-full resize-none rounded-[var(--radius-card)] border-0 bg-transparent p-5 text-body outline-none placeholder:text-fg3"
                value={gp.video_prompt}
                onChange={(e) => updatePrompt(realThemeIdx, origPi, { video_prompt: e.target.value })}
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-caption text-fg3">
                将按 {videoRatio ?? '9:16'} · {videoDuration ?? 10}s 进行生成
              </span>
              {(() => {
                const vkey = `${realThemeIdx}-${gp.group_id}`
                const isGen = videoGenerating[vkey]
                const prog = videoProgress[vkey]
                return (
                  <button
                    type="button"
                    onClick={() => handleGenerateVideo(realThemeIdx, origPi, gp)}
                    disabled={isGen}
                    className="btn-gradient !h-9 !px-5 !text-caption"
                  >
                    {isGen ? `生成中 ${prog || ''}` : gp.videoUrl ? '重新生成' : '生成视频'}
                  </button>
                )
              })()}
            </div>
          </div>
        )
      })}

      {/* Download */}
      <div className="mt-8 flex justify-center">
        <button type="button" onClick={onCompose} className="btn-gradient">
          资产合成
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

type FissionPersistedState = {
  videoUrl?: string
  storageKey?: string
  videoDuration?: number
  videoRatio?: string
  analysisAsset?: AnalysisAsset
  themes?: Theme[]
  selectedThemeIndices?: number[]
  customThemePrompt?: string
  themeTab?: 'recommend' | 'custom'
  themeCharacters?: ThemeCharacters[]
  themeVideoPrompts?: ThemeVideoPrompts[]
  composeOutputs?: ComposeOutput[]
  composeSelectedKeys?: string[]
  composePipeline?: ComposePipeline
  composeBaConfigId?: string
  maxReached?: number
  // Deprecated: 旧字段，读到它表示项目需要重新上传视频。
  videoAnalyze?: string
}

const STEP_KEYS = ['step1', 'step2', 'step3', 'step4', 'step5'] as const

function pickLatestImageUrl(themeChars: ThemeCharacters[]): string | undefined {
  for (let ti = themeChars.length - 1; ti >= 0; ti--) {
    const chars = themeChars[ti]?.characters ?? []
    for (let ci = chars.length - 1; ci >= 0; ci--) {
      if (chars[ci]?.imageUrl) return chars[ci].imageUrl
    }
  }
  return undefined
}

export default function FissionPage() {
  const searchParams = useSearchParams()
  const initialProjectId = searchParams?.get('projectId') ?? null

  const projectIdRef = useRef<string | null>(initialProjectId)
  const [projectLoaded, setProjectLoaded] = useState(!initialProjectId)

  const [step, setStep] = useState(0)
  const [maxReached, setMaxReached] = useState(0)

  // Step 1 state
  const [videoUrl, setVideoUrl] = useState('')
  const [storageKey, setStorageKey] = useState('')
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [videoRatio, setVideoRatio] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)

  // Step 1 -> Step 2 data
  const [analysisAsset, setAnalysisAsset] = useState<AnalysisAsset | null>(null)
  const [themes, setThemes] = useState<Theme[]>([])

  // Step 2 state
  const [themeTab, setThemeTab] = useState<'recommend' | 'custom'>('recommend')
  const [selectedThemeIndices, setSelectedThemeIndices] = useState<Set<number>>(new Set())
  const [customThemePrompt, setCustomThemePrompt] = useState('')
  const [regenThemes, setRegenThemes] = useState(false)
  const [regenProgress, setRegenProgress] = useState(0)
  const [charGenerating, setCharGenerating] = useState(false)
  const [charProgress, setCharProgress] = useState(0)

  // Step 3 data
  const [themeCharacters, setThemeCharacters] = useState<ThemeCharacters[]>([])

  // Step 3 -> Step 4 state
  const [vpGenerating, setVpGenerating] = useState(false)
  const [vpProgress, setVpProgress] = useState(0)

  // Step 4 data
  const [themeVideoPrompts, setThemeVideoPrompts] = useState<ThemeVideoPrompts[]>([])
  const [baConfigs, setBaConfigs] = useState<ComposeBaConfigItem[]>([])
  const [composeOutputs, setComposeOutputs] = useState<ComposeOutput[]>([])
  const [composeSelectedKeys, setComposeSelectedKeys] = useState<string[]>([])
  const [composePipeline, setComposePipeline] = useState<ComposePipeline | null>(null)
  const [composeBaConfigId, setComposeBaConfigId] = useState('')

  // Unified page-level progress modal state
  const [activeProgress, setActiveProgress] = useState<ActiveProgress>({
    open: false,
    title: '',
  })
  const closeProgress = useCallback(() => {
    setActiveProgress({ open: false, title: '' })
  }, [])

  // Latest state ref to avoid stale closures during async saves
  const latestStateRef = useRef<FissionPersistedState>({})
  useEffect(() => {
    latestStateRef.current = {
      videoUrl,
      storageKey,
      videoDuration: videoDuration ?? undefined,
      videoRatio: videoRatio ?? undefined,
      analysisAsset: analysisAsset || undefined,
      themes,
      selectedThemeIndices: Array.from(selectedThemeIndices),
      customThemePrompt,
      themeTab,
      themeCharacters,
      themeVideoPrompts,
      composeOutputs,
      composeSelectedKeys,
      composePipeline: composePipeline ?? undefined,
      composeBaConfigId: composeBaConfigId || undefined,
      maxReached,
    }
  }, [
    videoUrl,
    storageKey,
    videoDuration,
    videoRatio,
    analysisAsset,
    themes,
    selectedThemeIndices,
    customThemePrompt,
    themeTab,
    themeCharacters,
    themeVideoPrompts,
    composeOutputs,
    composeSelectedKeys,
    composePipeline,
    composeBaConfigId,
    maxReached,
  ])

  // Load existing project state on mount
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
        const s = (project?.state || {}) as FissionPersistedState
        if (cancelled) return
        if (s.videoUrl) setVideoUrl(s.videoUrl)
        if (s.storageKey) setStorageKey(s.storageKey)
        if (typeof s.videoDuration === 'number') setVideoDuration(s.videoDuration)
        if (typeof s.videoRatio === 'string') setVideoRatio(s.videoRatio)

        // v02 兼容：若只有旧 videoAnalyze 而没有 analysisAsset，视为过期状态，
        // 仅保留视频素材，强制回到 Step1 重新分析
        const hasAnalysisAsset = s.analysisAsset && typeof s.analysisAsset === 'object'
        const isLegacy = !hasAnalysisAsset && typeof s.videoAnalyze === 'string' && s.videoAnalyze.length > 0

        if (hasAnalysisAsset) {
          setAnalysisAsset(s.analysisAsset as AnalysisAsset)
          if (s.themes) setThemes(s.themes)
          if (s.selectedThemeIndices) setSelectedThemeIndices(new Set(s.selectedThemeIndices))
          if (typeof s.customThemePrompt === 'string') setCustomThemePrompt(s.customThemePrompt)
          if (s.themeTab === 'custom' || s.themeTab === 'recommend') setThemeTab(s.themeTab)
          if (s.themeCharacters) setThemeCharacters(s.themeCharacters)
          if (s.themeVideoPrompts) setThemeVideoPrompts(s.themeVideoPrompts)
          if (s.composeOutputs) setComposeOutputs(s.composeOutputs)
          if (s.composeSelectedKeys) setComposeSelectedKeys(s.composeSelectedKeys)
          if (s.composePipeline) setComposePipeline(s.composePipeline)
          if (s.composeBaConfigId) setComposeBaConfigId(s.composeBaConfigId)
        }

        const stepIdx = STEP_KEYS.indexOf((project?.currentStep || 'step1') as typeof STEP_KEYS[number])
        const reached = typeof s.maxReached === 'number' ? s.maxReached : Math.max(0, stepIdx)

        if (isLegacy) {
          // 旧项目：强制退回 Step1，提示用户重新分析
          setMaxReached(0)
          setStep(0)
        } else {
          setMaxReached(reached)
          setStep(Math.max(0, stepIdx))
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setProjectLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [initialProjectId])

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
    const nextKeys = themeVideoPrompts.flatMap((tv) =>
      tv.prompts
        .filter((gp) => !!gp.videoUrl)
        .map((gp) => storageKeyFromFileUrl(gp.videoUrl!))
        .filter(Boolean),
    )
    if (nextKeys.length === 0) return
    if (composeSelectedKeys.length > 0) return
    setComposeSelectedKeys(nextKeys)
  }, [composeSelectedKeys.length, themeVideoPrompts])

  // Project create / save helpers
  const ensureProject = useCallback(async (): Promise<string | null> => {
    if (projectIdRef.current) return projectIdRef.current
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'superpower',
          subKind: 'fission',
          name: 'Untitled',
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
        } catch { /* ignore */ }
        return id
      }
    } catch { /* ignore */ }
    return null
  }, [])

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
    } catch { /* ignore */ }
  }, [])

  // Auto-save when key state changes (debounced) – only if project exists
  useEffect(() => {
    if (!projectIdRef.current) return
    const handle = setTimeout(() => {
      const cover = pickLatestImageUrl(themeCharacters)
      saveProject({
        currentStep: STEP_KEYS[Math.max(0, Math.min(STEP_KEYS.length - 1, step))],
        ...(cover ? { coverImageUrl: cover } : {}),
      })
    }, 800)
    return () => clearTimeout(handle)
  }, [
    step,
    themeCharacters,
    themeVideoPrompts,
    selectedThemeIndices,
    customThemePrompt,
    themeTab,
    analysisAsset,
    themes,
    videoUrl,
    storageKey,
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

  // Step 1: Analyze video
  const handleAnalyze = useCallback(async () => {
    if (!storageKey) return
    setAnalyzing(true)
    setAnalyzeProgress(0)
    setActiveProgress({ open: true, title: '视频分析中', progress: 0, showProgressBar: true })
    try {
      // Create project record on first real action
      await ensureProject()

      const res = await fetch('/api/fission/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoStorageKey: storageKey, mode: 'full' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '提交分析失败')
      }
      const { taskId } = await res.json()
      const result = await pollTask(taskId, (pct) => {
        setAnalyzeProgress(pct)
        setActiveProgress({ open: true, title: '视频分析中', progress: pct, showProgressBar: true })
      })
      const nextAsset = result.analysisAsset as AnalysisAsset
      const nextThemes = result.themes as Theme[]
      setAnalysisAsset(nextAsset)
      setThemes(nextThemes)
      setSelectedThemeIndices(new Set())
      setCustomThemePrompt('')
      setThemeTab('recommend')
      advanceTo(1)
      // Refresh latestStateRef and persist immediately
      latestStateRef.current = {
        ...latestStateRef.current,
        analysisAsset: nextAsset,
        themes: nextThemes,
        selectedThemeIndices: [],
        customThemePrompt: '',
        themeTab: 'recommend',
        maxReached: Math.max(1, latestStateRef.current.maxReached ?? 0),
      }
      saveProject({ currentStep: 'step2' })
    } catch (err) {
      alert(err instanceof Error ? err.message : '分析失败')
    } finally {
      setAnalyzing(false)
      closeProgress()
    }
  }, [storageKey, advanceTo, ensureProject, saveProject, closeProgress])

  const handleRemoveUpload = useCallback(() => {
    setVideoUrl('')
    setStorageKey('')
    setVideoDuration(null)
    setVideoRatio(null)
    setAnalysisAsset(null)
    setThemes([])
    setSelectedThemeIndices(new Set())
    setCustomThemePrompt('')
    setThemeTab('recommend')
    setThemeCharacters([])
    setThemeVideoPrompts([])
    setComposeOutputs([])
    setComposeSelectedKeys([])
    setComposePipeline(null)
    setStep(0)
    setMaxReached(0)
  }, [])

  // Step 2: Regenerate 4 recommended themes (only uses analysisAsset)
  const handleRegenerateThemes = useCallback(async () => {
    if (!analysisAsset) return
    setRegenThemes(true)
    setRegenProgress(0)
    setActiveProgress({ open: true, title: '主题生成中', progress: 0, showProgressBar: true })
    try {
      const res = await fetch('/api/fission/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'themes-only', analysisAsset }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '重新生成失败')
      }
      const { taskId } = await res.json()
      const result = await pollTask(taskId, (pct) => {
        setRegenProgress(pct)
        setActiveProgress({ open: true, title: '主题生成中', progress: pct, showProgressBar: true })
      })
      const nextThemes = result.themes as Theme[]
      setThemes(nextThemes)
      setSelectedThemeIndices(new Set())
      latestStateRef.current = {
        ...latestStateRef.current,
        themes: nextThemes,
        selectedThemeIndices: [],
      }
      saveProject({})
    } catch (err) {
      alert(err instanceof Error ? err.message : '重新生成失败')
    } finally {
      setRegenThemes(false)
      closeProgress()
    }
  }, [analysisAsset, saveProject, closeProgress])

  // Step 2: Generate character prompts (统一入口，支持推荐 / 自定义两种主题来源)
  const handleGenerateCharPrompts = useCallback(async () => {
    if (!analysisAsset) return

    let selected: Theme[] = []
    let selectedThemeMeta: Array<{ theme: Theme; originalIndex: number }> = []
    if (themeTab === 'recommend') {
      if (selectedThemeIndices.size === 0) return
      selectedThemeMeta = Array.from(selectedThemeIndices)
        .map((i) => ({ theme: themes[i], originalIndex: i }))
        .filter((item): item is { theme: Theme; originalIndex: number } => Boolean(item.theme))
      selected = selectedThemeMeta.map((item) => item.theme)
    } else {
      const keyword = customThemePrompt.trim()
      if (!keyword) return
      const now = Date.now()
      selected = [{
        theme_source: 'user_input',
        theme_id: `user_${now}`,
        title: keyword.slice(0, 16) || '自定义主题',
        description: keyword,
        raw_theme_input: keyword,
      }]
      selectedThemeMeta = [{ theme: selected[0], originalIndex: -1 }]
    }
    if (selected.length === 0) return

    setCharGenerating(true)
    setCharProgress(0)
    setActiveProgress({ open: true, title: '素材提示词生成中', progress: 0, showProgressBar: true })
    try {
      const res = await fetch('/api/fission/character-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisAsset, selectedThemes: selected }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '提交失败')
      }
      const { taskId } = await res.json()
      const result = await pollTask(taskId, (pct) => {
        setCharProgress(pct)
        setActiveProgress({ open: true, title: '素材提示词生成中', progress: pct, showProgressBar: true })
      })
      const normalizedCharacterPrompts = (result.characterPrompts as ThemeCharacters[]).map((item, idx) => ({
        ...item,
        themeTitle: selectedThemeMeta[idx]?.theme.title || item.themeTitle,
        themeIndex: selectedThemeMeta[idx]?.originalIndex ?? item.themeIndex,
        selectedTheme: selectedThemeMeta[idx]?.theme,
      }))
      setThemeCharacters(normalizedCharacterPrompts)
      advanceTo(2)
      latestStateRef.current = {
        ...latestStateRef.current,
        themeCharacters: normalizedCharacterPrompts,
        maxReached: Math.max(2, latestStateRef.current.maxReached ?? 0),
      }
      saveProject({ currentStep: 'step3' })
    } catch (err) {
      alert(err instanceof Error ? err.message : '生成失败')
    } finally {
      setCharGenerating(false)
      closeProgress()
    }
  }, [analysisAsset, themeTab, selectedThemeIndices, themes, customThemePrompt, advanceTo, saveProject, closeProgress])

  // Step 3 -> 4: Generate video prompts
  const handleGenerateVideoPrompts = useCallback(async () => {
    if (!analysisAsset) return

    // 直接使用 themeCharacters 上绑定的 selectedTheme，避免相对索引错位
    const selected: Theme[] = themeCharacters.map((tc) => {
      if (tc.selectedTheme) return tc.selectedTheme
      const found = tc.themeIndex >= 0 ? themes[tc.themeIndex] : undefined
      if (found) return found
      return {
        theme_source: 'recommendation',
        theme_id: `theme_${tc.themeIndex + 1}`,
        title: tc.themeTitle,
        description: '',
      }
    })

    setVpGenerating(true)
    setVpProgress(0)
    setActiveProgress({ open: true, title: '视频提示词生成中', progress: 0, showProgressBar: true })
    try {
      const charDesc = themeCharacters
        .map((tc) => tc.characters.map((c) => `[${tc.themeTitle}] 组${c.group_id} ${c.character_name}: ${c.image_prompt}`).join('\n'))
        .join('\n')

      const res = await fetch('/api/fission/video-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisAsset, selectedThemes: selected, characterImagesDesc: charDesc }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '提交失败')
      }
      const { taskId } = await res.json()
      const result = await pollTask(taskId, (pct) => {
        setVpProgress(pct)
        setActiveProgress({ open: true, title: '视频提示词生成中', progress: pct, showProgressBar: true })
      })
      const normalizedVideoPrompts = (result.videoPrompts as ThemeVideoPrompts[]).map((item, idx) => {
        const tc = themeCharacters[idx]
        const remainingGroupIds: number[] = []
        for (const c of tc?.characters ?? []) {
          if (!remainingGroupIds.includes(c.group_id)) {
            remainingGroupIds.push(c.group_id)
          }
        }
        const mappedPrompts = remainingGroupIds.length > 0
          ? remainingGroupIds.map((gid, promptIdx) => ({
            group_id: Number(gid),
            video_prompt: String(item.prompts?.[promptIdx]?.video_prompt ?? ''),
          }))
          : (item.prompts ?? []).map((gp) => ({
            group_id: Number(gp.group_id),
            video_prompt: String(gp.video_prompt ?? ''),
          }))

        return {
          ...item,
          themeTitle: selected[idx]?.title || item.themeTitle,
          themeIndex: themeCharacters[idx]?.themeIndex ?? item.themeIndex,
          selectedTheme: selected[idx],
          prompts: mappedPrompts,
        }
      })
      console.info('[fission] normalizedVideoPrompts', normalizedVideoPrompts)
      setThemeVideoPrompts(normalizedVideoPrompts)
      advanceTo(3)
      latestStateRef.current = {
        ...latestStateRef.current,
        themeVideoPrompts: normalizedVideoPrompts,
        maxReached: Math.max(3, latestStateRef.current.maxReached ?? 0),
      }
      saveProject({ currentStep: 'step4' })
    } catch (err) {
      alert(err instanceof Error ? err.message : '生成失败')
    } finally {
      setVpGenerating(false)
      closeProgress()
    }
  }, [analysisAsset, themes, themeCharacters, advanceTo, saveProject, closeProgress])

  const toggleTheme = useCallback((idx: number) => {
    setSelectedThemeIndices((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  if (!projectLoaded) {
    return (
      <div className="flex items-center justify-center py-24 text-body">
        正在加载项目...
      </div>
    )
  }

  return (
    <div>
      <SubPageHeader
        title="礼物裂变"
        steps={STEPS}
        current={step}
        maxReached={maxReached}
        onStepClick={goToStep}
      />

      {step === 0 && (
        <UploadVideoStep
          videoUrl={videoUrl} setVideoUrl={setVideoUrl}
          storageKey={storageKey} setStorageKey={setStorageKey}
          setVideoDuration={setVideoDuration}
          setVideoRatio={setVideoRatio}
          onRemove={handleRemoveUpload}
          onAnalyze={handleAnalyze} analyzing={analyzing} progress={analyzeProgress}
        />
      )}

      {step === 1 && (
        <SelectThemesStep
          themes={themes}
          selectedIndices={selectedThemeIndices}
          toggleTheme={toggleTheme}
          themeTab={themeTab}
          setThemeTab={setThemeTab}
          customThemePrompt={customThemePrompt}
          setCustomThemePrompt={setCustomThemePrompt}
          onGenerate={handleGenerateCharPrompts}
          generating={charGenerating}
          progress={charProgress}
          onRegenerate={handleRegenerateThemes}
          regenerating={regenThemes}
          regenProgress={regenProgress}
        />
      )}

      {step === 2 && (
        <AssetBoardStep
          themeCharacters={themeCharacters}
          setThemeCharacters={setThemeCharacters}
          onGenerateVideoPrompts={handleGenerateVideoPrompts}
          generating={vpGenerating}
          progress={vpProgress}
          setActiveProgress={setActiveProgress}
          closeProgress={closeProgress}
        />
      )}

      {step === 3 && (
        <VideoBoardStep
          themeVideoPrompts={themeVideoPrompts}
          setThemeVideoPrompts={setThemeVideoPrompts}
          themeCharacters={themeCharacters}
          setThemeCharacters={setThemeCharacters}
          setActiveProgress={setActiveProgress}
          closeProgress={closeProgress}
          onCompose={() => {
            setComposeOutputs([])
            advanceTo(4)
          }}
          videoRatio={videoRatio}
          videoDuration={videoDuration}
        />
      )}

      {step === 4 && (
        <PostprocessComposeStep
          videos={themeVideoPrompts.flatMap((tv) =>
            tv.prompts
              .filter((gp) => !!gp.videoUrl)
              .map((gp) => ({
                key: storageKeyFromFileUrl(gp.videoUrl!),
                label: `${tv.themeTitle} · 组${gp.group_id}`,
                url: gp.videoUrl!,
              }))
              .filter((item) => item.key),
          )}
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

      <GenerateProgressModal
        open={activeProgress.open}
        title={activeProgress.title}
        progress={activeProgress.progress}
        statusText={activeProgress.statusText}
        showProgressBar={activeProgress.showProgressBar}
      />
    </div>
  )
}
