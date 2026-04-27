import Sidebar from '@/components/Sidebar'
import BackgroundVideo from '@/components/ui/BackgroundVideo'
import Overlay from '@/components/ui/Overlay'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen text-fg">
      <BackgroundVideo mode="play-once" />
      <Overlay />
      <div className="relative z-20">
        <Sidebar />
      </div>
      <main className="relative z-20 flex min-h-screen flex-1 flex-col overflow-x-hidden px-24 py-24">
        {children}
        <footer className="mt-auto pt-16 text-center text-caption text-fg3">
          © 抖音直播 - AI特效创意 2026
        </footer>
      </main>
    </div>
  )
}
