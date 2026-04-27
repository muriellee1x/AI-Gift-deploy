'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, SVGProps } from 'react'
import { useEffect, useState } from 'react'
import logoHome from '@/assets/logo/logo_home.png'
import logoWhite from '@/assets/logo/logo_wthite.svg'
import { HomeIcon, RecordIcon, SettingIcon } from './ui/BrandIcons'
import UserAvatar from './UserAvatar'

type NavItem = {
  label: string
  href: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const NAV_ITEMS: NavItem[] = [
  { label: '首页', href: '/atomic', icon: HomeIcon },
  { label: '我的记录', href: '/records', icon: RecordIcon },
  { label: '资源配置', href: '/settings', icon: SettingIcon },
]

const STORAGE_KEY = 'gift-master-sidebar-collapsed'

function isPathActive(pathname: string, href: string) {
  if (href === '/atomic') {
    return pathname === '/atomic' || pathname.startsWith('/atomic/')
  }
  return pathname === href || pathname.startsWith(href + '/')
}

export default function Sidebar() {
  const pathname = usePathname() ?? ''
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved === '1') setCollapsed(true)
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      }
      return next
    })
  }

  const widthClass = collapsed ? 'w-[5vw] min-w-[72px]' : 'w-[10vw] min-w-[220px]'

  return (
    <aside
      className={`sticky top-0 relative flex h-screen shrink-0 flex-col border-r border-white/10 bg-white/5 px-4 py-8 transition-[width] duration-200 anim-sidebar-slide ${widthClass}`}
      suppressHydrationWarning
    >
      {/* Logo */}
      <button
        type="button"
        onClick={toggle}
        className={`flex w-full rounded-[var(--radius-side)] px-2 py-2 text-left transition-colors anim-sidebar-logo ${
          collapsed ? 'justify-center' : ''
        }`}
        title={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        <Image
          src={collapsed ? logoWhite : logoHome}
          alt="Gift Master"
          className={collapsed ? 'h-8 w-auto object-contain' : 'h-8 w-auto object-contain'}
          priority
        />
      </button>

      {/* Nav */}
      <nav className="mt-8 flex flex-1 flex-col gap-6">
        {NAV_ITEMS.map((item) => {
          const active = isPathActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`btn-side anim-sidebar-nav ${collapsed ? 'justify-center px-0' : ''}`}
              data-active={active ? 'true' : 'false'}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`h-[24px] w-[24px] shrink-0 transition-opacity ${active ? 'opacity-100' : 'opacity-60'}`}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Avatar */}
      <div className={`mt-auto pt-4 anim-sidebar-avatar ${collapsed ? 'flex justify-center' : ''}`}>
        <UserAvatar collapsed={collapsed} />
      </div>
    </aside>
  )
}
