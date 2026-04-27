'use client'

import { useState } from 'react'

type PreviewableMediaProps = {
  type: 'image' | 'video'
  src: string
  alt?: string
  className?: string
  wrapperClassName?: string
  controls?: boolean
}

export default function PreviewableMedia({
  type,
  src,
  alt = '媒体预览',
  className = '',
  wrapperClassName = '',
  controls = true,
}: PreviewableMediaProps) {
  const [open, setOpen] = useState(false)

  if (!src) return null

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={`cursor-zoom-in ${wrapperClassName}`}
      >
        {type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className={className} />
        ) : (
          <video src={src} controls={controls} className={className} />
        )}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-6 backdrop-blur-2xl"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-8 top-8 flex h-7 w-7 items-center justify-center rounded-full border border-white/18 bg-white/4 text-[12px] text-white/85 transition hover:border-white/50 hover:bg-white/8 hover:text-white/50 hover:cursor-pointer"
            >
              ✕
          </button>

          <div
            className="flex max-h-[90vh] max-w-[92vw] items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            {type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt}
                className="max-h-[90vh] max-w-[92vw] rounded-[var(--radius-card)] object-contain"
              />
            ) : (
              <video
                src={src}
                controls
                className="max-h-[90vh] max-w-[92vw] rounded-[var(--radius-card)] bg-black/40 object-contain"
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
