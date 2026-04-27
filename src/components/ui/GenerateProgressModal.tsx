'use client'

import { useEffect, useRef, useState } from 'react'

export default function GenerateProgressModal({
  open,
  title,
  progress,
  statusText,
  showProgressBar,
}: {
  open: boolean
  title: string
  progress?: number
  statusText?: string
  showProgressBar?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [animationDuration, setAnimationDuration] = useState(3)

  useEffect(() => {
    if (!open) return

    const video = videoRef.current
    if (!video) return

    const applyPlaybackRate = () => {
      video.playbackRate = 0.75
    }

    const syncAnimationDuration = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setAnimationDuration(video.duration / 0.75)
      }
    }

    applyPlaybackRate()
    syncAnimationDuration()
    video.addEventListener('loadedmetadata', applyPlaybackRate)
    video.addEventListener('loadedmetadata', syncAnimationDuration)
    video.play().catch(() => {
      /* ignore autoplay rejection */
    })

    return () => {
      video.removeEventListener('loadedmetadata', applyPlaybackRate)
      video.removeEventListener('loadedmetadata', syncAnimationDuration)
    }
  }, [open])

  if (!open) return null

  void progress
  void showProgressBar

  const displayText = statusText?.trim() || title

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-2xl" />

      <div className="relative z-[1] flex h-full w-full items-center justify-center px-6">
        <div className="relative h-[200px] w-[640px] max-w-[92vw] overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-black/40">
          <video
            ref={videoRef}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[70vh] w-[70vw] -translate-x-1/2 -translate-y-[47%] object-cover opacity-90 mix-blend-screen"
            src="/brand/loading/loading.mp4"
            autoPlay
            muted
            loop
            playsInline
          />

          <div className="pointer-events-none absolute inset-0 bg-black/10" />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 pt-24 text-center">
            <p
              className="max-w-[70%] text-h4 text-white/70"
              style={{ animation: `loadingTextBreath ${animationDuration}s ease-in-out infinite` }}
            >
              {displayText}
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes loadingTextBreath {
          0%,
          100% {
            opacity: 0.25;
          }
          25% {
            opacity: 0.85;
          }
          50% {
            opacity: 0.4;
          }
          75% {
            opacity: 0.95;
          }
        }
      `}</style>
    </div>
  )
}
