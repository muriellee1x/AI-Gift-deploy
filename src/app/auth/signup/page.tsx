'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import BackgroundVideo from '@/components/ui/BackgroundVideo'
import { HideIcon } from '@/components/ui/BrandIcons'
import PillInput from '@/components/ui/PillInput'
import GradientButton from '@/components/ui/GradientButton'

export default function SignUpPage() {
  const [name, setName] = useState('')
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push('/auth/signin')
      } else {
        setError(data.message || '注册失败')
      }
    } catch {
      setError('网络错误')
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
          <h1 className="text-h3">注册 Gift Master</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PillInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入用户名"
            autoComplete="username"
          />
          <PillInput
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码（至少 6 位）"
            autoComplete="new-password"
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
            {loading ? '注册中...' : '注册'}
          </GradientButton>
        </form>

        <p className="mt-6 text-center text-caption">
          已有账号？{' '}
          <Link href="/auth/signin" className="text-[color:var(--color-brand-2)] hover:underline">
            去登录
          </Link>
        </p>
      </div>
      </div>
    </div>
  )
}
