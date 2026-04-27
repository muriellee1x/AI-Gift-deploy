'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

export default function UserAvatar({ collapsed = false }: { collapsed?: boolean }) {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (status === 'loading') {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
  }

  if (!session?.user) {
    return (
      <Link
        href="/auth/signin"
        className={`flex items-center gap-3 rounded-[var(--radius-side)] px-2 py-2 text-fg3 hover:text-fg2 ${
          collapsed ? 'justify-center' : 'w-fit max-w-full'
        }`}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
        {!collapsed && <span className="text-body">登录</span>}
      </Link>
    )
  }

  const displayName = session.user.name ?? '?'
  const initial = displayName[0].toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-3 rounded-[var(--radius-side)] p-2 text-left transition-colors ${
          collapsed ? 'justify-center' : 'w-fit max-w-full'
        }`}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          style={{ backgroundColor: '#0D6DFF', color: '#F4F3EC' }}
        >
          {initial}
        </div>
        {!collapsed && (
          <span className="min-w-0 truncate text-body text-fg2">{displayName}</span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-16 z-50 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] py-0 shadow-2xl">
          <div className="border-b border-white/5 px-4 py-3">
            <p className="truncate text-body text-fg">{displayName}</p>
          </div>
          <button
            onClick={async () => {
              await signOut({ redirect: false })
              window.location.href = '/auth/signin'
            }}
            className="w-full px-4 py-3 text-left text-body text-red-400 transition-colors hover:bg-white/5"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}
