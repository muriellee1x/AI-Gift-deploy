'use client'

import { usePathname } from 'next/navigation'

export default function Overlay() {
  const pathname = usePathname() ?? ''

  if (pathname === '/atomic' || pathname === '/atomic/') {
    return null
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-10 bg-black/75 backdrop-blur-xl"
    />
  )
}
