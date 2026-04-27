'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

type Mode = 'loop' | 'play-once'

const START_VIDEO_SRC = '/brand/bg/BG-motion-start.mp4'
const LOOP_VIDEO_SRC = '/brand/bg/BG-motion-loop.mp4'

export default function BackgroundVideo({ mode }: { mode: Mode }) {
  const ref = useRef<HTMLVideoElement>(null)
  const pathname = usePathname() ?? ''
  const isHome = pathname === '/atomic' || pathname === '/atomic/'
  const [src, setSrc] = useState(START_VIDEO_SRC)
  const [shouldLoop, setShouldLoop] = useState(false)

  useEffect(() => {
    if (mode === 'loop' || isHome) {
      setSrc(START_VIDEO_SRC)
      setShouldLoop(false)
      return
    }

    // 非首页直接展示循环背景。
    setSrc(LOOP_VIDEO_SRC)
    setShouldLoop(true)
  }, [isHome, mode])

  useEffect(() => {
    const v = ref.current
    if (!v) return

    v.loop = shouldLoop

    const playCurrent = () => {
      try {
        v.currentTime = 0
      } catch {
        /* ignore */
      }
      v.play().catch(() => {})
    }

    if (v.readyState >= 1) {
      playCurrent()
    } else {
      v.addEventListener('loadedmetadata', playCurrent, { once: true })
    }

    const onEnded = () => {
      if (shouldLoop) return
      setSrc(LOOP_VIDEO_SRC)
      setShouldLoop(true)
    }

    v.addEventListener('ended', onEnded)
    return () => {
      v.removeEventListener('ended', onEnded)
      v.removeEventListener('loadedmetadata', playCurrent)
    }
  }, [shouldLoop, src])

  return (
    <video
      ref={ref}
      className="bg-video-fade pointer-events-none fixed inset-0 z-0 h-full w-full object-cover opacity-100"
      src={src}
      autoPlay
      muted
      playsInline
      preload="auto"
    />
  )
}
