'use client'

import PreviewableMedia from '@/components/ui/PreviewableMedia'

type MediaFrameProps = {
  type: 'image' | 'video'
  src?: string
  alt?: string
  heightClassName?: string
  aspectClassName?: string
  containerClassName?: string
  children?: React.ReactNode
  emptyState?: React.ReactNode
}

export default function MediaFrame({
  type,
  src,
  alt = '媒体预览',
  heightClassName,
  aspectClassName,
  containerClassName = '',
  children,
  emptyState,
}: MediaFrameProps) {
  const sizeClassName = aspectClassName ?? heightClassName ?? 'h-[320px]'

  return (
    <div
      className={`relative w-full overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-black/40 ${sizeClassName} ${containerClassName}`}
    >
      {src ? (
        type === 'image' ? (
          <>
            <div className="pointer-events-none absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                aria-hidden="true"
                className="h-full w-full scale-110 object-cover opacity-65 blur-xl"
              />
              <div className="absolute inset-0 bg-black/30" />
            </div>

            <PreviewableMedia
              type="image"
              src={src}
              alt={alt}
              wrapperClassName="relative z-[1] flex h-full w-full items-center justify-center"
              className="h-full w-full object-contain"
            />
          </>
        ) : (
          <PreviewableMedia
            type="video"
            src={src}
            alt={alt}
            wrapperClassName="flex h-full w-full items-center justify-center"
            className="h-full w-full object-contain"
          />
        )
      ) : (
        emptyState ?? <div className="h-full w-full" />
      )}

      {children}
    </div>
  )
}
