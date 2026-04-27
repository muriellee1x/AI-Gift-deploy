import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Providers from '@/components/Providers'
import './globals.css'

const douyin = localFont({
  src: '../assets/fonts/douyinmeihaoti.otf',
  variable: '--font-douyin',
  display: 'swap',
})

const pfMedium = localFont({
  src: '../assets/fonts/PingFang Medium.ttf',
  variable: '--font-pf-medium',
  display: 'swap',
})

const pfRegular = localFont({
  src: '../assets/fonts/PingFang Regular.ttf',
  variable: '--font-pf-regular',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Gift Master',
  description: '灵感一到 礼物即成',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="zh"
      className={`${douyin.variable} ${pfMedium.variable} ${pfRegular.variable}`}
    >
      <body className="min-h-screen bg-ink text-fg">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
