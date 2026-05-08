'use client'

import { useCallback, useRef, useState } from 'react'
import ImageEditModal from '@/components/ui/ImageEditModal'
import MediaFrame from '@/components/ui/MediaFrame'
import GenerateProgressModal from '@/components/ui/GenerateProgressModal'

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

type Props = {
  /** 当前步骤生成/上传的图像 URL */
  imageUrl: string
  /** 对应的 storage key，用于编辑和提交 */
  imageStorageKey: string
  /** 图像生成提示词（可编辑） */
  promptText: string
  onPromptChange: (v: string) => void
  /** 接收新生成/上传/编辑后的图像 */
  onImageChange: (url: string, storageKey: string) => void
  /** 绿底原始图 URL，作为图像生成的参考图 */
  greenImageUrl: string
  /** 点击「提示词生成」按钮 */
  onSubmit: () => void
  submitting?: boolean
  disabled?: boolean
}

export default function ReskinImageGenerateStep({
  imageUrl,
  imageStorageKey,
  promptText,
  onPromptChange,
  onImageChange,
  greenImageUrl,
  onSubmit,
  submitting,
  disabled,
}: Props) {
  const [generating, setGenerating] = useState(false)
  const [generateProgress, setGenerateProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasImage = !!imageUrl

  const handleGenerate = useCallback(async () => {
    if (!promptText.trim()) {
      alert('请先填写图像提示词')
      return
    }
    setGenerating(true)
    setGenerateProgress(0)
    try {
      const res = await fetch('/api/reskin/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText.trim(),
          refImageUrl: greenImageUrl,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message || '图像生成提交失败')
      }
      const { taskId } = await res.json()
      const result = await pollTask(taskId, setGenerateProgress)
      onImageChange(result.imageUrl as string, (result.storageKey as string) || '')
    } catch (err) {
      alert(err instanceof Error ? err.message : '图像生成失败')
    } finally {
      setGenerating(false)
    }
  }, [promptText, greenImageUrl, onImageChange])

  const handleUploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('仅支持图片文件')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message || '图片上传失败')
      }
      const data = await res.json()
      onImageChange(data.imageUrl as string, (data.storageKey as string) || '')
    } catch (err) {
      alert(err instanceof Error ? err.message : '图片上传失败')
    } finally {
      setUploading(false)
    }
  }, [onImageChange])

  const isLoading = generating || uploading || !!submitting || !!disabled

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* 左：图像预览区 */}
        <div>
          <p className="mb-4 text-h4">生成图像</p>
          <div className="flex h-[500px] items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-black/25">
            {hasImage ? (
              <MediaFrame
                type="image"
                src={imageUrl}
                alt="生成图像"
                heightClassName="h-full"
              />
            ) : (
              <p className="text-12px text-white/20">暂无生成图像</p>
            )}
          </div>
        </div>

        {/* 右：提示词编辑区 + 操作按钮 */}
        <div>
          <p className="mb-4 text-h4">图像提示词</p>
          <div className="inbox-prompt-box relative p-0 pr-2">
            <textarea
              className="scrollbar-prompt min-h-[420px] w-full resize-none rounded-[var(--radius-card)] border-0 bg-transparent p-5 text-body outline-none placeholder:text-fg3"
              value={promptText}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="这里会展示上一步生成的图像提示词，可以继续编辑"
              disabled={isLoading}
            />
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="btn-secondary-pill"
            >
              {uploading ? '上传中...' : '上传图像'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleUploadFile(file)
                  e.target.value = ''
                }
              }}
            />

            <button
              type="button"
              onClick={() => setEditOpen(true)}
              disabled={isLoading || !hasImage}
              className="btn-secondary-pill"
            >
              编辑图像
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading || !promptText.trim()}
              className="btn-secondary-pill"
            >
              {generating ? '生成中...' : hasImage ? '重新生成' : '开始生成'}
            </button>

            <button
              type="button"
              onClick={onSubmit}
              disabled={isLoading || !hasImage || !imageStorageKey}
              className="btn-gradient"
            >
              {submitting ? '生成中...' : '提示词生成'}
            </button>
          </div>
        </div>
      </div>

      {/* 编辑图像弹窗 */}
      <ImageEditModal
        open={editOpen}
        imageUrl={imageUrl}
        imageStorageKey={imageStorageKey || undefined}
        onClose={() => setEditOpen(false)}
        onConfirm={(result) => {
          onImageChange(result.imageUrl, result.storageKey || '')
        }}
        defaultPrompt={promptText}
      />

      <GenerateProgressModal
        open={generating}
        title="图像生成中"
        progress={generateProgress}
      />
    </>
  )
}
