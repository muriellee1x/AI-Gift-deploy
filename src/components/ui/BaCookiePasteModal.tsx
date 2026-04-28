'use client'

import { useState } from 'react'

interface BaCookiePasteModalProps {
  configId: string
  loginUrl: string
  onSuccess: () => void
  onClose: () => void
}

export default function BaCookiePasteModal({
  configId,
  loginUrl,
  onSuccess,
  onClose,
}: BaCookiePasteModalProps) {
  const [cookie, setCookie] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/ba-config/${configId}/cookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookieHeader: cookie.trim() }),
      })
      const data = await res.json() as { success?: boolean; error?: string; message?: string }
      if (!res.ok) {
        setError(data.error || data.message || '保存失败')
        return
      }
      onSuccess()
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1117] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-h4">刷新 ByteArtist Cookie</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Steps */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-caption font-medium text-white/70">操作步骤</p>
            <ol className="space-y-2 text-[13px] text-white/60">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-white/80">1</span>
                <span>
                  在下方点击「打开 ByteArtist」，在新标签页中完成登录
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-white/80">2</span>
                <span>登录后按 <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-[11px]">F12</kbd> 打开开发者工具，切换到 <strong className="text-white/80">Network</strong> 标签</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-white/80">3</span>
                <span>在页面随意点击，在 Network 列表中找到任意一个请求，点击后查看 <strong className="text-white/80">Headers → Request Headers</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-white/80">4</span>
                <span>找到 <strong className="text-white/80">cookie</strong> 那一行，复制其完整值，粘贴到下方输入框</span>
              </li>
            </ol>

            <a
              href={loginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] text-white/70 transition-colors hover:border-white/20 hover:text-white"
            >
              打开 ByteArtist
              <span className="text-[10px] opacity-60">↗</span>
            </a>
          </div>

          {/* Cookie input */}
          <div className="space-y-2">
            <label className="text-caption text-white/60">
              粘贴 Cookie
            </label>
            <textarea
              value={cookie}
              onChange={(e) => { setCookie(e.target.value); setError('') }}
              rows={4}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-[12px] text-white/80 placeholder:text-white/20 focus:border-white/20 focus:outline-none"
              placeholder="sessionid=xxxx; session_key=yyyy; ..."
              disabled={loading}
            />
            {error && (
              <p className="text-[12px] text-red-400">{error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="sub-btn-tab"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !cookie.trim()}
              className="sub-btn-tab !text-[color:var(--color-brand-2)] hover:!border-[#46cbff] hover:!text-[color:var(--color-brand-2)] disabled:opacity-40"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-fg" />
                  验证中...
                </span>
              ) : '验证并保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
