'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import BackgroundVideo from '@/components/ui/BackgroundVideo'
import { HideIcon } from '@/components/ui/BrandIcons'
import PillInput from '@/components/ui/PillInput'
import GradientButton from '@/components/ui/GradientButton'

export default function SignInPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      })
      if (result?.error) {
        setError('用户名或密码错误')
      } else {
        router.push('/atomic')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden">
      <BackgroundVideo mode="loop" />

      <div className="auth-card-shell relative z-20">
        <div className="auth-card-panel p-10">
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/brand/logo/logo_gradient.png"
            alt="Gift Master"
            width={72}
            height={72}
            className="mb-3 h-14 w-14 object-contain"
            priority
          />
          <h1 className="text-h3">登录 Gift Master</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PillInput
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名"
            autoComplete="username"
          />
          <PillInput
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            autoComplete="current-password"
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="flex h-6 w-6 items-center justify-center text-white/20 hover:text-white/20"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                <HideIcon
                  className="h-[14px] w-[18px]"
                />
              </button>
            }
          />

          {error && <p className="text-caption text-red-400">{error}</p>}

          <GradientButton
            type="submit"
            disabled={loading}
            className="h-12 w-full"
          >
            {loading ? '登录中...' : '登录'}
          </GradientButton>
        </form>

        <p className="mt-6 text-center text-caption">
          还没有账号？{' '}
          <Link href="/auth/signup" className="text-[color:var(--color-brand-2)] hover:underline">
            去注册
          </Link>
        </p>
      </div>
      </div>
    </div>
  )
}
