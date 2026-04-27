'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Capability data
// ---------------------------------------------------------------------------

type Capability = {
  name: string
  model?: string
  models?: string[]
  href?: string
  comingSoon?: boolean
  cover?: string
  hoverVideoSrc?: string
}

type CategoryKey = 'superpower' | 'vertical' | 'general' | 'postprocess'

const DEFAULT_COVER = '/brand/bg/card-BG-blue.png'
const DEFAULT_HOVER_VIDEO = '/brand/hover_motion/placeholder.mp4'
const DISABLED_CARD_HIT = '/brand/bg/card_disable_hit.png'

const CATEGORIES: { key: CategoryKey; label: string; items: Capability[] }[] = [
  {
    key: 'superpower',
    label: 'AI 超能力',
    items: [
      {
        name: '礼物换肤',
        model: 'Seedance2.0',
        href: '/atomic/reskin',
        hoverVideoSrc: '/brand/hover_motion/换肤.mp4',
      },
      {
        name: '礼物裂变',
        models: ['Seedance2.0', '即梦4.0'],
        href: '/atomic/fission',
        hoverVideoSrc: '/brand/hover_motion/裂变.mp4',
      },
      {
        name: '形象礼物',
        model: 'Seedance2.0',
        comingSoon: true,
        hoverVideoSrc: DEFAULT_HOVER_VIDEO,
      },
    ],
  },
  {
    key: 'vertical',
    label: '垂类礼物管线',
    items: [
      { name: '花花管线 V2.0', models: ['Seedance2.0', '即梦4.0'], href: '/atomic/flower2', hoverVideoSrc:'/brand/hover_motion/花花2.mp4'  },
      { name: '花花管线 V1.0', models: ['Seedance2.0', '即梦4.0'], href: '/atomic/flower', hoverVideoSrc: '/brand/hover_motion/花花1.mp4' },
      { name: '美食管线', models: ['Seedance2.0', '即梦4.0'],href: '/atomic/food', hoverVideoSrc: '/brand/hover_motion/美食.mp4' },
      { name: '景观管线', models: ['Seedance2.0', '即梦4.5'], href: '/atomic/scene', hoverVideoSrc: '/brand/hover_motion/景观.mp4' },
    ],
  },
  {
    key: 'general',
    label: '通用礼物管线',
    items: [
      { name: '0 – 3000 钻', models: ['Wan22', '即梦4.0'], comingSoon: true, hoverVideoSrc: DEFAULT_HOVER_VIDEO },
      { name: '3000 – 6000 钻', models: ['Wan22', '即梦4.0'], comingSoon: true, hoverVideoSrc: DEFAULT_HOVER_VIDEO },
    ],
  },
  {
    key: 'postprocess',
    label: '资产合成管线',
    items: [
      { name: '礼物icon合成', model: '自研节点组', href: '/atomic/postprocess/icon', hoverVideoSrc: '/brand/hover_motion/icon.mp4' },
      { name: '扣绿后处理', model: '自研节点组', href: '/atomic/postprocess/green', hoverVideoSrc: '/brand/hover_motion/绿幕.mp4'},
      { name: '高价效通用后处理', model: '自研节点组', href: '/atomic/postprocess/general', hoverVideoSrc: '/brand/hover_motion/通用.mp4' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function CapabilityCard({ item, animationClass }: { item: Capability; animationClass: string }) {
  const disabled = !!item.comingSoon
  const hoverVideoRef = useRef<HTMLVideoElement>(null)
  const models = (item.models?.length ? item.models : item.model ? [item.model] : []).slice(0, 3)

  const seekToTailFrame = useCallback(() => {
    const video = hoverVideoRef.current
    if (!video) return

    try {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.max(0, video.duration - 0.05)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const video = hoverVideoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      video.pause()
      seekToTailFrame()
    }

    if (video.readyState >= 1) {
      handleLoadedMetadata()
    } else {
      video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [item.hoverVideoSrc, seekToTailFrame])

  const handleMouseEnter = () => {
    if (disabled) return
    const video = hoverVideoRef.current
    if (!video) return

    try {
      video.currentTime = 0
    } catch {
      /* ignore */
    }
    video.play().catch(() => {})
  }

  const handleMouseLeave = () => {
    const video = hoverVideoRef.current
    if (!video) return

    video.pause()
    seekToTailFrame()
  }

  const body = (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`surface-card group relative flex h-[400px] w-[400px] shrink-0 snap-start flex-col overflow-hidden transition-all ${animationClass} ${
        disabled ? 'opacity-100' : 'hover:cursor-pointer hover:shadow-[0_0_20px_rgba(13,109,255,0.75)]'
      }`}
    >
      {disabled ? (
        <Image
          src={DISABLED_CARD_HIT}
          alt=""
          fill
          sizes="400px"
          className="pointer-events-none z-0 object-cover"
          priority={false}
        />
      ) : (
        <video
          ref={hoverVideoRef}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          src={item.hoverVideoSrc ?? DEFAULT_HOVER_VIDEO}
          muted
          playsInline
          preload="metadata"
        />
      )}
      <Image
        src={item.cover ?? DEFAULT_COVER}
        alt={item.name}
        fill
        sizes="400px"
        className="z-[1] object-cover"
        priority={false}
      />
      <div className="absolute inset-0 z-[2]" />
      {disabled && (
        <span className="absolute right-4 top-4 z-[5] rounded-full bg-black/60 px-3 py-1 text-caption text-fg2 backdrop-blur-md">
          敬请期待
        </span>
      )}

      {/* Footer */}
      <div className="absolute inset-x-0 bottom-0 z-[3] flex items-end justify-between p-6">
        <div className="min-w-0 space-y-2">
          <h3 className="truncate text-h3">{item.name}</h3>
          {models.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {models.map((model) => (
                <span key={model} className="chip">
                  {model}
                </span>
              ))}
            </div>
          )}
        </div>
        {!disabled && (
          <button className="btn-ghost-pill" type="button">
            即刻开始
          </button>
        )}
      </div>
      {disabled && <div className="pointer-events-none absolute inset-0 z-[4] bg-black/50" />}
    </div>
  )

  if (item.href && !disabled) {
    return (
      <Link href={item.href} className="snap-start">
        {body}
      </Link>
    )
  }

  return body
}

// ---------------------------------------------------------------------------
// Horizontal scroller with arrows
// ---------------------------------------------------------------------------

function CardRow({ items, cardAnimationClass }: { items: Capability[]; cardAnimationClass: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollLeft = 0
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [items, update])

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * 420, behavior: 'smooth' })
  }

  return (
    <div className="relative -mr-24">
      <div
        ref={ref}
        className="no-scrollbar -ml-6 -my-8 flex snap-x snap-mandatory gap-6 overflow-x-auto pl-6 scroll-pl-6 py-8 pr-6"
      >
        {items.map((item) => (
          <CapabilityCard key={item.name} item={item} animationClass={cardAnimationClass} />
        ))}
      </div>

      {canLeft && (
        <button
          type="button"
          aria-label="向左滚动"
          onClick={() => scrollBy(-1)}
          className="group absolute inset-y-0 -left-6 z-10 flex w-[144px] items-center justify-center transition-opacity anim-home-arrow"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.72) 56%, rgba(0, 0, 0, 0))',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
            maskImage:
              'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/90 transition-transform group-hover:-translate-x-0.5"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="向右滚动"
          onClick={() => scrollBy(1)}
          className="group absolute inset-y-0 -right-0 z-10 flex w-[144px] items-center justify-center transition-opacity anim-home-arrow"
          style={{
            backgroundImage:
              'linear-gradient(to left, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.72) 56%, rgba(0, 0, 0, 0))',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
            maskImage:
              'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/90 transition-transform group-hover:translate-x-0.5"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AtomicPage() {
  const [active, setActive] = useState<CategoryKey>('superpower')
  const [cardAnimationClass, setCardAnimationClass] = useState('anim-home-card')

  const activeItems = CATEGORIES.find((c) => c.key === active)?.items ?? []

  return (
    <div className="flex flex-col gap-40">
      <header className="pt-4">
        <h1 className="text-h1 anim-home-title">
          <span>灵感一到 礼物</span>
          <span className="text-gradient-1">即成</span>
        </h1>
        <p className="mt-2 font-pf-regular text-[16px] tracking-[0.06em] text-white anim-home-subtitle">From Idea to Gift, Instantly</p>
      </header>

      <section>
        <h2 className="mb-8 text-h2 anim-home-section">探索我们的原子能力</h2>

        <div className="mb-6 flex flex-wrap gap-2 anim-home-categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className="btn-tab"
              data-active={cat.key === active ? 'true' : 'false'}
              onClick={() => {
                setCardAnimationClass('anim-home-card-fade')
                setActive(cat.key)
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <CardRow
          key={`${active}-${cardAnimationClass}`}
          items={activeItems}
          cardAnimationClass={cardAnimationClass}
        />
      </section>
    </div>
  )
}
