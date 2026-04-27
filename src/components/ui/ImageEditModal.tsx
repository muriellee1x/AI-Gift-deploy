'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Dropdown from '@/components/ui/Dropdown'

type Resolution = '1K' | '2K' | '4K'

type ApiConfigItem = {
  id: string
  category: string
  name: string
  modelName: string
  isDefault: boolean
}

const RESOLUTION_OPTIONS: readonly Resolution[] = ['1K', '2K', '4K']

async function pollTask(taskId: string): Promise<Record<string, unknown>> {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const res = await fetch(`/api/tasks/${taskId}`)
    if (!res.ok) throw new Error('轮询任务失败')
    const data = await res.json()
    const task = data.task
    if (task.status === 'completed') return (task.result ?? {}) as Record<string, unknown>
    if (task.status === 'failed') throw new Error(task.errorMessage || '任务失败')
  }
}

export default function ImageEditModal({
  open,
  imageUrl,
  imageStorageKey,
  onClose,
  onConfirm,
  defaultPrompt = '',
  promptValue,
  onPromptChange,
}: {
  open: boolean
  imageUrl: string
  imageStorageKey?: string
  onClose: () => void
  onConfirm: (result: { imageUrl: string; storageKey?: string }) => void
  defaultPrompt?: string
  promptValue?: string
  onPromptChange?: (value: string) => void
}) {
  const [stage, setStage] = useState<'edit' | 'compare'>('edit')
  const [beforeUrl, setBeforeUrl] = useState('')
  const [beforeStorageKey, setBeforeStorageKey] = useState<string | undefined>(undefined)
  const [resultUrl, setResultUrl] = useState('')
  const [resultStorageKey, setResultStorageKey] = useState<string | undefined>(undefined)
  const [selectedUrl, setSelectedUrl] = useState('')
  const [prompt, setPrompt] = useState('')
  const [apiConfigs, setApiConfigs] = useState<ApiConfigItem[]>([])
  const [apiConfigId, setApiConfigId] = useState('')
  const [resolution, setResolution] = useState<Resolution>('1K')
  const [submitting, setSubmitting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const isPromptControlled = typeof promptValue === 'string'
  const currentPrompt = isPromptControlled ? (promptValue ?? '') : prompt

  const modelOptions = useMemo(
    () => [
      { value: '', label: '默认图像模型' },
      ...apiConfigs.map((config) => ({
        value: config.id,
        label: `${config.name} / ${config.modelName}`,
      })),
    ],
    [apiConfigs]
  )

  const resolutionOptions = useMemo(
    () => RESOLUTION_OPTIONS.map((option) => ({ value: option, label: option })),
    []
  )

  useEffect(() => {
    if (!open) return

    setStage('edit')
    setBeforeUrl(imageUrl)
    setBeforeStorageKey(imageStorageKey)
    setResultUrl('')
    setResultStorageKey(undefined)
    setSelectedUrl('')
    if (!isPromptControlled) {
      setPrompt(defaultPrompt ?? '')
    }
    setResolution('1K')
    setPreviewUrl('')

    fetch('/api/api-config')
      .then((res) => res.json())
      .then((data) => {
        const items = ((data.configs || []) as ApiConfigItem[])
          .filter((item) => item.category === 'image')
        setApiConfigs(items)
        const fallback = items.find((item) => item.isDefault) || items[0]
        setApiConfigId(fallback?.id || '')
      })
      .catch(() => {
        setApiConfigs([])
        setApiConfigId('')
      })
  }, [defaultPrompt, imageStorageKey, imageUrl, isPromptControlled, open])

  const handleGenerate = useCallback(async () => {
    if (!currentPrompt.trim() || !beforeUrl) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/fission/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: beforeUrl,
          prompt: currentPrompt.trim(),
          apiConfigId: apiConfigId || undefined,
          resolution,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '编辑失败')
      }
      const data = await res.json()
      const result = await pollTask(data.taskId as string)
      const nextUrl = result.imageUrl as string
      const nextStorageKey = result.storageKey as string | undefined
      if (!nextUrl) throw new Error('编辑结果缺少 imageUrl')
      setResultUrl(nextUrl)
      setResultStorageKey(nextStorageKey)
      setSelectedUrl(nextUrl)
      setStage('compare')
    } catch (err) {
      alert(err instanceof Error ? err.message : '编辑失败')
    } finally {
      setSubmitting(false)
    }
  }, [apiConfigId, beforeUrl, currentPrompt, resolution])

  if (!open) return null

  const openPreview = (url: string) => {
    if (!url) return
    setPreviewUrl(url)
  }

  const resolveSelectedStorageKey = (url: string): string | undefined => {
    if (url && url === resultUrl) return resultStorageKey
    if (url && url === beforeUrl) return beforeStorageKey
    return undefined
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6 backdrop-blur-md"
        onClick={onClose}
      >
        <div
          className="content-card w-[1100px] max-w-[95vw] p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-h3">{stage === 'edit' ? '编辑图像' : ''}</h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-fg3 transition-colors hover:bg-white/5 hover:text-fg"
            >
              ✕
            </button>
          </div>

          {stage === 'edit' ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div
                onClick={() => openPreview(beforeUrl)}
                className="flex max-h-[520px] min-h-[460px] cursor-zoom-in items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-black/30 p-4"
              >
                {beforeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={beforeUrl}
                    alt="待编辑图片"
                    className="max-h-[480px] max-w-full h-auto w-auto rounded-[var(--radius-card)] object-contain"
                  />
                ) : (
                  <span className="text-body text-fg3">暂无图片</span>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <p className="text-body text-fg3">编辑提示词</p>
                <div className="inbox-prompt-box flex-1 p-2 pr-2">
                  <textarea
                    className="scrollbar-prompt h-full min-h-[360px] w-full resize-none rounded-[var(--radius-card)] border-0 bg-transparent p-5 text-body outline-none placeholder:text-fg3"
                    placeholder="输入编辑提示词，例如：给花束点缀几朵白色小雏菊"
                    value={currentPrompt}
                    onChange={(e) => {
                      const nextValue = e.target.value
                      if (!isPromptControlled) {
                        setPrompt(nextValue)
                      }
                      onPromptChange?.(nextValue)
                    }}
                    disabled={submitting}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-3">
                    <Dropdown
                      value={apiConfigId}
                      onChange={(nextValue) => setApiConfigId(nextValue)}
                      options={modelOptions}
                      className="w-[180px]"
                      buttonClassName="!h-10"
                    />

                    <Dropdown
                      value={resolution}
                      onChange={(nextValue) => setResolution(nextValue as Resolution)}
                      options={resolutionOptions}
                      className="w-[80px]"
                      buttonClassName="!h-10"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={submitting || !currentPrompt.trim()}
                    className="btn-gradient"
                  >
                    {submitting ? '生成中...' : '开始生成'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {[
                  { label: '编辑前', url: beforeUrl },
                  { label: '编辑后', url: resultUrl },
                ].map((item) => {
                  const selected = selectedUrl === item.url
                  return (
                    <div key={item.label} className="flex flex-col items-center gap-3">
                      <p className="text-body text-fg3">{item.label}</p>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (selected) openPreview(item.url)
                          else setSelectedUrl(item.url)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            if (selected) openPreview(item.url)
                            else setSelectedUrl(item.url)
                          }
                        }}
                        className={`flex max-h-[520px] min-h-[460px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-card)] border-1 bg-black/30 p-4 transition-[border-color,box-shadow] ${
                          selected
                            ? 'border-[color:var(--color-brand-2)]'
                            : 'border-white/10'
                        }`}
                      >
                        {item.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.url}
                            alt={item.label}
                            className="max-h-[480px] max-w-full h-auto w-auto rounded-[var(--radius-card)] object-contain"
                          />
                        ) : (
                          <span className="text-body text-fg3">暂无图片</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedUrl) return
                    const nextBeforeStorageKey = resolveSelectedStorageKey(selectedUrl)
                    setBeforeUrl(selectedUrl)
                    setBeforeStorageKey(nextBeforeStorageKey)
                    setResultUrl('')
                    setResultStorageKey(undefined)
                    setSelectedUrl('')
                    setStage('edit')
                  }}
                  className="btn-alt"
                >
                  继续编辑
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedUrl) return
                    onConfirm({
                      imageUrl: selectedUrl,
                      storageKey: resolveSelectedStorageKey(selectedUrl),
                    })
                    onClose()
                  }}
                  className="btn-gradient"
                >
                  完成编辑
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {previewUrl ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-10"
          onClick={() => setPreviewUrl('')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="预览"
            className="max-h-[90vh] max-w-[90vw] h-auto w-auto rounded-[var(--radius-card)] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setPreviewUrl('')}
            className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-fg transition-colors hover:bg-black/70"
          >
            ✕
          </button>
        </div>
      ) : null}
    </>
  )
}
