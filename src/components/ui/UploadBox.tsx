'use client'

import { useRef, useState } from 'react'
import MediaFrame from '@/components/ui/MediaFrame'

type UploadKind = 'image' | 'video'

function inferUploadKind(accept: string): UploadKind | undefined {
  if (accept.includes('image')) return 'image'
  if (accept.includes('video') || accept.includes('.mp4')) return 'video'
  return undefined
}

function UploadPlaceholderIcon({ kind }: { kind: UploadKind }) {
  const iconPath = kind === 'image' ? '/brand/icons/upload-image.svg' : '/brand/icons/upload-video.svg'

  return (
    <span
      aria-hidden="true"
      className="block h-12 w-12 bg-white/20"
      style={{
        WebkitMask: `url(${iconPath}) center / contain no-repeat`,
        mask: `url(${iconPath}) center / contain no-repeat`,
      }}
    />
  )
}

export default function UploadBox({
  title,
  description,
  active,
  onSelect,
  accept,
  kind,
  hasFile,
  uploading,
  onRemove,
  previewSrc,
  previewAlt,
  previewHeightClassName,
  children,
}: {
  title: string
  description: string
  active?: boolean
  onSelect: (file: File) => void
  accept: string
  kind?: UploadKind
  hasFile?: boolean
  uploading?: boolean
  onRemove?: () => void
  previewSrc?: string
  previewAlt?: string
  previewHeightClassName?: string
  children?: React.ReactNode
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const resolvedKind = kind ?? inferUploadKind(accept)
  const uploadLabel = resolvedKind === 'image' ? '上传图片' : resolvedKind === 'video' ? '上传视频' : ''
  const previewAltText = previewAlt ?? title
  const previewBoxHeightClassName = previewHeightClassName ?? 'h-[320px]'

  const renderPreview = () => {
    if (!resolvedKind) return children

    return (
      <MediaFrame
        type={resolvedKind}
        src={previewSrc}
        alt={previewAltText}
        heightClassName={previewBoxHeightClassName}
      />
    )
  }

  return (
    <div
      className={`rounded-[var(--radius-card)] border-2 border-dashed p-5 transition-colors ${
        dragOver
          ? 'border-[color:var(--color-brand-2)] bg-[color:var(--color-brand-2)]/10'
          : active
          ? 'border-white/15 bg-white/[0.03]'
          : 'border-white/10 bg-white/[0.02]'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) onSelect(file)
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-h4">{title}</p>
          <p className="mt-1 text-12px text-fg3">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (fileRef.current) fileRef.current.value = ''
            fileRef.current?.click()
          }}
          className="sub-btn-tab"
        >
          选择文件
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onSelect(file)
          }}
        />
      </div>
      <div className="group relative">
        {previewSrc !== undefined || resolvedKind ? renderPreview() : children}

        {!hasFile && resolvedKind ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              {!uploading ? (
                <>
                  <UploadPlaceholderIcon kind={resolvedKind} />
                  <p className="text-12px text-white/20">{uploadLabel}</p>
                </>
              ) : (
                <p className="text-12px text-white/40">上传中...</p>
              )}
            </div>
          </div>
        ) : null}

        {hasFile && onRemove ? (
          <button
            type="button"
            aria-label={`删除${title}`}
            onClick={() => {
              if (fileRef.current) fileRef.current.value = ''
              onRemove()
            }}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-sm text-white/85 opacity-0 transition hover:border-white/30 hover:bg-black/75 hover:text-white group-hover:opacity-100"
          >
            ✕
          </button>
        ) : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}
