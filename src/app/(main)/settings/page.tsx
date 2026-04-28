'use client'

import { useState, useEffect, useCallback } from 'react'
import { DeleteIcon, EditIcon } from '@/components/ui/BrandIcons'
import BaCookiePasteModal from '@/components/ui/BaCookiePasteModal'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApiConfigItem = {
  id: string
  category: string
  name: string
  baseUrl: string
  modelName: string
  isDefault: boolean
  apiKeyMasked: string
  createdAt: string
}

type FormData = {
  id?: string
  category: string
  name: string
  baseUrl: string
  apiKey: string
  modelName: string
  isDefault: boolean
}

type TestResult = {
  status: 'idle' | 'testing' | 'success' | 'fail'
  message: string
}

type CookieAgeStatus = 'green' | 'yellow' | 'red-soft' | 'red-invalid' | 'none'

type BaConfigItem = {
  id: string
  name: string
  roomUrl: string
  benchBaseUrl: string | null
  hasCookie: boolean
  cookieObtainedAt: string | null
  cookieValid: boolean
  cookieAgeStatus: CookieAgeStatus
  isDefault: boolean
  createdAt: string
}

type BaFormData = {
  id?: string
  name: string
  roomUrl: string
}

type TopTab = 'api' | 'ba'
type ApiSubTab = 'llm' | 'image' | 'video'

const API_SUB_TABS: { value: ApiSubTab; label: string }[] = [
  { value: 'llm', label: 'LLM 文本模型' },
  { value: 'image', label: '图片生成模型' },
  { value: 'video', label: '视频生成模型' },
]

// ---------------------------------------------------------------------------
// Form components (dark themed)
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-caption text-fg2">
        {label}
        {hint ? <span className="ml-1 text-fg3">{hint}</span> : null}
      </label>
      {children}
    </div>
  )
}

function ApiConfigForm({
  item,
  isEditing,
  onSave,
  onCancel,
  saving,
}: {
  item: FormData
  isEditing: boolean
  onSave: (item: FormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(item)
  const [test, setTest] = useState<TestResult>({ status: 'idle', message: '' })

  const canTest = form.baseUrl.trim() && form.apiKey.trim() && form.modelName.trim()

  async function handleTest() {
    if (!canTest) return
    setTest({ status: 'testing', message: '' })
    try {
      const res = await fetch('/api/api-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: form.baseUrl.trim(),
          apiKey: form.apiKey.trim(),
          modelName: form.modelName.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setTest({ status: 'success', message: data.message || '连接成功' })
      } else {
        setTest({ status: 'fail', message: data.error || '连接失败' })
      }
    } catch {
      setTest({ status: 'fail', message: '请求失败，请检查网络' })
    }
  }

  return (
    <div className="content-card space-y-4 p-6">
      <h3 className="text-h4">{isEditing ? '编辑 API 配置' : '新增 API 配置'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="名称">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input-box"
            placeholder="如：我的 GPT-4o"
          />
        </Field>
        <Field label="类别">
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="input-box"
          >
            {API_SUB_TABS.map((c) => (
              <option key={c.value} value={c.value} className="bg-[#17181d] text-fg">
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Base URL">
          <input
            value={form.baseUrl}
            onChange={(e) => { setForm({ ...form, baseUrl: e.target.value }); setTest({ status: 'idle', message: '' }) }}
            className="input-box"
            placeholder="https://api.openai.com/v1"
          />
        </Field>
        <Field label="模型名称">
          <input
            value={form.modelName}
            onChange={(e) => { setForm({ ...form, modelName: e.target.value }); setTest({ status: 'idle', message: '' }) }}
            className="input-box"
            placeholder="gpt-4o"
          />
        </Field>
        <div className="col-span-2">
          <Field
            label="API Key"
            hint={isEditing ? '(留空则不修改)' : undefined}
          >
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => { setForm({ ...form, apiKey: e.target.value }); setTest({ status: 'idle', message: '' }) }}
              className="input-box"
              placeholder={isEditing ? '留空不修改，输入新值则更新' : 'sk-...'}
            />
          </Field>
        </div>
        <div className="col-span-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="h-4 w-4 rounded border-white/20 bg-transparent"
            />
            <span className="text-body">设为该类别的默认模型</span>
          </label>
        </div>
      </div>

      {test.status !== 'idle' && (
        <div
          className={`rounded-xl p-3 text-body ${
            test.status === 'testing'
              ? 'border border-white/10 bg-white/5 text-fg2'
              : test.status === 'success'
              ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
              : 'border border-red-400/30 bg-red-400/10 text-red-300'
          }`}
        >
          {test.status === 'testing' && (
            <span className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-fg" />
              正在测试连接...
            </span>
          )}
          {test.status !== 'testing' && test.message}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="sub-btn-tab">
          取消
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={!canTest || test.status === 'testing'}
          className="sub-btn-tab"
        >
          测试连接
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving}
          className="sub-btn-tab !text-[color:var(--color-brand-2)] hover:!border-[#46cbff] hover:!text-[color:var(--color-brand-2)]"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}

function BaConfigForm({
  item,
  isEditing,
  onSave,
  onCancel,
  saving,
}: {
  item: BaFormData
  isEditing: boolean
  onSave: (item: BaFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(item)

  return (
    <div className="content-card space-y-4 p-6">
      <h3 className="text-h4">{isEditing ? '编辑 BA 配置' : '新增 BA 配置'}</h3>
      <Field label="名称">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input-box"
          placeholder="如：我的 BA 房间"
        />
      </Field>
      <Field label="房间 URL">
        <input
          value={form.roomUrl}
          onChange={(e) => setForm({ ...form, roomUrl: e.target.value })}
          className="input-box"
          placeholder="https://byteartist.bytedance.net/workflow-as-room/room/bench-xxx"
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="sub-btn-tab">
          取消
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim() || !form.roomUrl.trim()}
          className="sub-btn-tab !text-[color:var(--color-brand-2)] hover:!border-[#46cbff] hover:!text-[color:var(--color-brand-2)]"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [topTab, setTopTab] = useState<TopTab>('api')
  const [apiSubTab, setApiSubTab] = useState<ApiSubTab>('llm')

  // API Config state
  const [configs, setConfigs] = useState<ApiConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<FormData | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [error, setError] = useState('')

  // BA Config state
  const [baConfigs, setBaConfigs] = useState<BaConfigItem[]>([])
  const [baLoading, setBaLoading] = useState(true)
  const [baSaving, setBaSaving] = useState(false)
  const [baEditing, setBaEditing] = useState<BaFormData | null>(null)
  const [baIsEditMode, setBaIsEditMode] = useState(false)
  const [baError, setBaError] = useState('')
  const [baActionStatus, setBaActionStatus] = useState<
    Record<string, { action: string; status: string; message: string }>
  >({})
  const [baCookieModal, setBaCookieModal] = useState<{ configId: string; loginUrl: string } | null>(null)

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/api-config')
      if (res.status === 401) {
        window.location.href = '/auth/signin'
        return
      }
      const data = await res.json()
      setConfigs(data.configs ?? [])
    } catch {
      setError('加载配置失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchBaConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/ba-config')
      if (res.status === 401) return
      const data = await res.json()
      setBaConfigs(data.configs ?? [])
    } catch {
      setBaError('加载 BA 配置失败')
    } finally {
      setBaLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfigs()
    fetchBaConfigs()
  }, [fetchConfigs, fetchBaConfigs])

  // -------- API handlers --------

  function handleAdd() {
    setIsEditMode(false)
    setEditing({
      category: apiSubTab,
      name: '',
      baseUrl: '',
      apiKey: '',
      modelName: '',
      isDefault: false,
    })
  }

  function handleEdit(item: ApiConfigItem) {
    setIsEditMode(true)
    setEditing({
      id: item.id,
      category: item.category,
      name: item.name,
      baseUrl: item.baseUrl,
      apiKey: '',
      modelName: item.modelName,
      isDefault: item.isDefault,
    })
  }

  async function handleSave(form: FormData) {
    setError('')
    setSaving(true)
    try {
      if (isEditMode && form.id) {
        const body: Record<string, unknown> = {
          category: form.category,
          name: form.name,
          baseUrl: form.baseUrl,
          modelName: form.modelName,
          isDefault: form.isDefault,
        }
        if (form.apiKey.trim()) body.apiKey = form.apiKey
        const res = await fetch(`/api/api-config/${form.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.message || '更新失败')
        }
      } else {
        if (!form.apiKey.trim()) {
          setError('新增配置时 API Key 为必填')
          setSaving(false)
          return
        }
        const res = await fetch('/api/api-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.message || '保存失败')
        }
      }
      setEditing(null)
      await fetchConfigs()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这个 API 配置吗？')) return
    try {
      const res = await fetch(`/api/api-config/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
      await fetchConfigs()
    } catch {
      setError('删除失败')
    }
  }

  async function handleSetDefault(item: ApiConfigItem) {
    try {
      const res = await fetch(`/api/api-config/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      if (!res.ok) throw new Error('设置失败')
      await fetchConfigs()
    } catch {
      setError('设置默认失败')
    }
  }

  // -------- BA handlers --------

  function handleBaAdd() {
    setBaIsEditMode(false)
    setBaEditing({ name: '', roomUrl: '' })
  }

  function handleBaEdit(item: BaConfigItem) {
    setBaIsEditMode(true)
    setBaEditing({ id: item.id, name: item.name, roomUrl: item.roomUrl })
  }

  async function handleBaSave(form: BaFormData) {
    setBaError('')
    setBaSaving(true)
    try {
      if (baIsEditMode && form.id) {
        const res = await fetch(`/api/ba-config/${form.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, roomUrl: form.roomUrl }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.message || '更新失败')
        }
      } else {
        const res = await fetch('/api/ba-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.message || '保存失败')
        }
      }
      setBaEditing(null)
      await fetchBaConfigs()
    } catch (err) {
      setBaError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBaSaving(false)
    }
  }

  async function handleBaDelete(id: string) {
    if (!confirm('确定要删除这个 BA 配置吗？')) return
    try {
      const res = await fetch(`/api/ba-config/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
      await fetchBaConfigs()
    } catch {
      setBaError('删除失败')
    }
  }

  async function handleBaSetDefault(item: BaConfigItem) {
    try {
      const res = await fetch(`/api/ba-config/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      if (!res.ok) throw new Error('设置失败')
      await fetchBaConfigs()
    } catch {
      setBaError('设置默认失败')
    }
  }

  async function handleBaAction(id: string, action: 'login' | 'cookie' | 'test') {
    // login: 从 API 拿到 URL 后在新标签页打开，再弹 Cookie 粘贴 Modal
    if (action === 'login') {
      setBaActionStatus((prev) => ({ ...prev, [id]: { action, status: 'loading', message: '' } }))
      try {
        const res = await fetch(`/api/ba-config/${id}/login`, { method: 'POST' })
        const data = await res.json() as { success?: boolean; loginUrl?: string; message?: string }
        if (data.success && data.loginUrl) {
          window.open(data.loginUrl, '_blank', 'noopener,noreferrer')
          setBaCookieModal({ configId: id, loginUrl: data.loginUrl })
          setBaActionStatus((prev) => ({ ...prev, [id]: { action, status: 'idle', message: '' } }))
        } else {
          setBaActionStatus((prev) => ({ ...prev, [id]: { action, status: 'fail', message: data.message || '获取登录地址失败' } }))
        }
      } catch {
        setBaActionStatus((prev) => ({ ...prev, [id]: { action, status: 'fail', message: '请求失败，请检查网络' } }))
      }
      return
    }

    // cookie: 弹出粘贴 Modal
    if (action === 'cookie') {
      const item = baConfigs.find((c) => c.id === id)
      const loginUrl = item?.benchBaseUrl ?? ''
      setBaCookieModal({ configId: id, loginUrl })
      return
    }

    // test: 原逻辑不变
    setBaActionStatus((prev) => ({
      ...prev,
      [id]: { action, status: 'loading', message: '' },
    }))
    try {
      const res = await fetch(`/api/ba-config/${id}/test`, { method: 'POST' })
      const data = await res.json() as { success?: boolean; message?: string }
      if (data.success) {
        setBaActionStatus((prev) => ({
          ...prev,
          [id]: { action, status: 'success', message: data.message || '连接成功' },
        }))
      } else {
        setBaActionStatus((prev) => ({
          ...prev,
          [id]: { action, status: 'fail', message: data.message || '连接失败' },
        }))
      }
    } catch {
      setBaActionStatus((prev) => ({
        ...prev,
        [id]: { action, status: 'fail', message: '请求失败，请检查网络' },
      }))
    }
  }

  // -------- Render --------

  const currentApiItems = configs
    .filter((c) => c.category === apiSubTab)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))

  const sortedBaConfigs = [...baConfigs].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-6">
        <div className="flex items-center gap-8 border-b border-white/10 pb-1">
          {[
            { key: 'api' as TopTab, label: 'API 配置管理' },
            { key: 'ba' as TopTab, label: 'BA 配置管理' },
          ].map((t) => {
            const active = topTab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTopTab(t.key)
                  setEditing(null)
                  setBaEditing(null)
                }}
                className={`relative flex items-center gap-2 pb-3 text-h3 transition-colors ${
                  active ? 'text-fg' : 'text-fg3 hover:text-fg2'
                }`}
              >
                {t.label}
                {active && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-gradient-brand" />}
              </button>
            )
          })}
        </div>

        {topTab === 'api' ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {API_SUB_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className="btn-tab"
                  data-active={t.value === apiSubTab ? 'true' : 'false'}
                  onClick={() => setApiSubTab(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleAdd} className="btn-gradient">
              + 添加配置
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end">
            <button type="button" onClick={handleBaAdd} className="btn-gradient">
              + 添加配置
            </button>
          </div>
        )}
      </div>

      <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6 pt-6">
        {topTab === 'api' && (
          <section className="flex flex-col gap-6">
            {error && (
              <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-body text-red-300">
                {error}
                <button onClick={() => setError('')} className="ml-2 opacity-60 hover:opacity-100">
                  ×
                </button>
              </div>
            )}

            {editing && (
              <ApiConfigForm
                item={editing}
                isEditing={isEditMode}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
                saving={saving}
              />
            )}

            {loading ? (
              <p className="text-body text-fg3">加载中...</p>
            ) : currentApiItems.length === 0 ? (
              <p className="text-body text-fg3">该类别暂无配置，点击右上角添加</p>
            ) : (
              <div className="flex flex-col gap-3">
                {currentApiItems.map((item) => (
                  <div key={item.id} className="surface-card flex items-center justify-between gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-h4">{item.name}</p>
                        {item.isDefault && <span className="chip-gradient">默认</span>}
                      </div>
                      <p className="mt-1 truncate text-body">
                        {item.baseUrl} / {item.modelName}
                      </p>
                      <p className="mt-0.5 text-caption">Key: {item.apiKeyMasked}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!item.isDefault && (
                        <button type="button" onClick={() => handleSetDefault(item)} className="sub-btn-tab">
                          设为默认
                        </button>
                      )}
                      <button type="button" onClick={() => handleEdit(item)} className="sub-btn-tab">
                        <EditIcon className="h-3.5 w-3.5" />
                        编辑
                      </button>
                      <button type="button" onClick={() => handleDelete(item.id)} className="sub-btn-tab !text-red-300 hover:!border-red-300/50">
                        <DeleteIcon className="h-3.5 w-3.5" />
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {topTab === 'ba' && (
          <section className="flex flex-col gap-6">
            {baError && (
              <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-body text-red-300">
                {baError}
                <button onClick={() => setBaError('')} className="ml-2 opacity-60 hover:opacity-100">
                  ×
                </button>
              </div>
            )}

            {baEditing && (
              <BaConfigForm
                item={baEditing}
                isEditing={baIsEditMode}
                onSave={handleBaSave}
                onCancel={() => setBaEditing(null)}
                saving={baSaving}
              />
            )}

            {baLoading ? (
              <p className="text-body text-fg3">加载中...</p>
            ) : baConfigs.length === 0 ? (
              <p className="text-body text-fg3">暂无 BA 配置，点击右上角按钮添加</p>
            ) : (
              <div className="flex flex-col gap-4">
                {sortedBaConfigs.map((item) => {
                  const actionState = baActionStatus[item.id]
                  const daysAgo = item.cookieObtainedAt
                    ? Math.floor((Date.now() - new Date(item.cookieObtainedAt).getTime()) / (1000 * 60 * 60 * 24))
                    : null
                  return (
                    <div key={item.id} className="surface-card p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-h4">{item.name}</p>
                            {item.isDefault && <span className="chip-gradient">默认</span>}
                          </div>
                          <p className="mt-1 truncate text-body">{item.roomUrl}</p>
                          {item.benchBaseUrl && (
                            <p className="truncate text-caption">Bench: {item.benchBaseUrl}</p>
                          )}
                          {/* Cookie 状态三色显示 */}
                          {item.cookieAgeStatus === 'none' && (
                            <p className="mt-1 text-caption text-amber-300">Cookie 未获取，请粘贴 Cookie</p>
                          )}
                          {item.cookieAgeStatus === 'green' && (
                            <p className="mt-1 text-caption text-[color:var(--color-brand-2)]">
                              ✓ Cookie 有效{daysAgo !== null ? `（${daysAgo} 天前获取）` : ''}
                            </p>
                          )}
                          {item.cookieAgeStatus === 'yellow' && (
                            <p className="mt-1 text-caption text-amber-300">
                              ⚠ Cookie 可能即将过期（{daysAgo} 天前获取，建议刷新）
                            </p>
                          )}
                          {item.cookieAgeStatus === 'red-soft' && (
                            <p className="mt-1 text-caption text-red-300">
                              ⚠ Cookie 大概率已过期（{daysAgo} 天前获取，请刷新）
                            </p>
                          )}
                          {item.cookieAgeStatus === 'red-invalid' && (
                            <p className="mt-1 text-caption text-red-400">
                              ✕ Cookie 已失效（API 返回 401），请刷新
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {!item.isDefault && (
                            <button type="button" onClick={() => handleBaSetDefault(item)} className="sub-btn-tab">
                              设为默认
                            </button>
                          )}
                          <button type="button" onClick={() => handleBaEdit(item)} className="sub-btn-tab">
                            <EditIcon className="h-3.5 w-3.5" />
                            编辑
                          </button>
                          <button type="button" onClick={() => handleBaDelete(item.id)} className="sub-btn-tab !text-red-300 hover:!border-red-300/50">
                            <DeleteIcon className="h-3.5 w-3.5" />
                            删除
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-4">
                        <button
                          type="button"
                          onClick={() => handleBaAction(item.id, 'login')}
                          disabled={actionState?.action === 'login' && actionState.status === 'loading'}
                          className="sub-btn-tab"
                        >
                          {actionState?.action === 'login' && actionState.status === 'loading' ? '打开中...' : '打开 ByteArtist'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBaAction(item.id, 'cookie')}
                          className="sub-btn-tab"
                        >
                          粘贴 Cookie
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBaAction(item.id, 'test')}
                          disabled={!item.hasCookie || (actionState?.action === 'test' && actionState.status === 'loading')}
                          className="sub-btn-tab"
                        >
                          {actionState?.action === 'test' && actionState.status === 'loading' ? '测试中...' : '测试连接'}
                        </button>
                      </div>

                      {actionState && actionState.status !== 'loading' && (
                        <div
                          className={`mt-3 rounded-xl border p-3 text-caption ${
                            actionState.status === 'success'
                              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                              : 'border-red-400/30 bg-red-400/10 text-red-300'
                          }`}
                        >
                          {actionState.message}
                        </div>
                      )}
                      {actionState?.status === 'loading' && (
                        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-caption">
                          <span className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-fg" />
                            {actionState.action === 'login' && '正在获取登录地址...'}
                            {actionState.action === 'test' && '正在测试连接...'}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* BA Cookie 粘贴 Modal */}
      {baCookieModal && (
        <BaCookiePasteModal
          configId={baCookieModal.configId}
          loginUrl={baCookieModal.loginUrl}
          onSuccess={async () => {
            setBaCookieModal(null)
            await fetchBaConfigs()
          }}
          onClose={() => setBaCookieModal(null)}
        />
      )}
    </div>
  )
}
