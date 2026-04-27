'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DeleteIcon, EditIcon } from '@/components/ui/BrandIcons'

type ProjectItem = {
  id: string
  name: string
  kind: string
  subKind: string
  currentStep: string
  coverImageUrl: string | null
  createdAt: string
  updatedAt: string
}

const KIND_ORDER = ['superpower', 'vertical', 'general', 'postprocess'] as const

const KIND_LABEL: Record<(typeof KIND_ORDER)[number], string> = {
  superpower: 'AI超能力',
  vertical: '垂类礼物管线',
  general: '通用礼物管线',
  postprocess: '资产合成管线',
}

const SUBKIND_LABEL: Record<string, string> = {
  reskin: '礼物换肤',
  fission: '礼物裂变',
  flower2: '花花管线 V2.0',
  flower: '花花管线 V1.0',
  food: '美食管线',
  scene: '景观管线',
  icon: '礼物icon合成',
  green: '扣绿后处理',
  general: '高价效通用后处理',
}

function projectHref(project: ProjectItem): string {
  if (project.kind === 'postprocess') {
    return `/atomic/postprocess/${project.subKind}?projectId=${project.id}`
  }
  return `/atomic/${project.subKind}?projectId=${project.id}`
}

function RecordCard({
  project,
  onOpen,
  onRename,
  onDelete,
}: {
  project: ProjectItem
  onOpen: () => void
  onRename: (newName: string) => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameValue, setNameValue] = useState(project.name)
  const [coverError, setCoverError] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (!menuOpen) return
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [renaming])

  useEffect(() => {
    setCoverError(false)
  }, [project.coverImageUrl, project.id])

  const subKindLabel = SUBKIND_LABEL[project.subKind] || project.subKind

  function handleRenameSubmit() {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== project.name) {
      onRename(trimmed)
    } else {
      setNameValue(project.name)
    }
    setRenaming(false)
  }

  return (
    <div className={`relative flex w-[360px] flex-col gap-4 overflow-visible ${menuOpen ? 'z-20' : ''}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen()
          }
        }}
        className="block cursor-pointer"
      >
        <div className="h-[240px] w-[360px] overflow-hidden rounded-[var(--radius-card)] border border-white/45">
          {project.coverImageUrl && !coverError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.coverImageUrl}
              alt={project.name}
              className="h-full w-full object-cover"
              onError={() => setCoverError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#0f0f12] text-caption text-fg3">
              {project.coverImageUrl ? '封面不可用' : null}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              ref={inputRef}
              value={nameValue}
              onChange={(event) => setNameValue(event.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleRenameSubmit()
                if (event.key === 'Escape') {
                  setNameValue(project.name)
                  setRenaming(false)
                }
              }}
              className="input-box max-w-[240px]"
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <p className="truncate text-h3" title={project.name}>
                  {project.name}
                </p>
                <span className="chip bg-[color:var(--color-brand-1)]/20 text-[color:var(--color-brand-2)]">
                  {subKindLabel}
                </span>
              </div>
              <p className="mt-3 text-caption">
                更新于 {new Date(project.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </>
          )}
        </div>

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setMenuOpen((value) => !value)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-fg3"
            aria-label="更多操作"
          >
            <span className="text-lg leading-none">···</span>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-10 z-50 w-40 overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] py-0 shadow-2xl">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setMenuOpen(false)
                  setRenaming(true)
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-body text-fg2 hover:bg-white/5"
              >
                <EditIcon className="h-4 w-4" />
                重命名
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setMenuOpen(false)
                  onDelete()
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-body text-fg2 hover:bg-white/5"
              >
                <DeleteIcon className="h-4 w-4" />
                删除
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function RecordsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeKind, setActiveKind] = useState<(typeof KIND_ORDER)[number]>('superpower')

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) return
      const data = await res.json()
      setProjects(data.projects ?? [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const grouped = useMemo(() => {
    const map: Record<string, ProjectItem[]> = {}
    for (const project of projects) {
      const kind = KIND_ORDER.includes(project.kind as (typeof KIND_ORDER)[number])
        ? project.kind
        : 'superpower'
      if (!map[kind]) map[kind] = []
      map[kind].push(project)
    }
    return map
  }, [projects])

  const activeProjects = grouped[activeKind] || []

  async function handleRename(id: string, newName: string) {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (res.ok) {
        setProjects((prev) => prev.map((project) => (project.id === id ? { ...project, name: newName } : project)))
      }
    } catch {
      /* ignore */
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这个项目吗？删除后不可恢复。')) return
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setProjects((prev) => prev.filter((project) => project.id !== id))
      }
    } catch {
      /* ignore */
    }
  }

  function handleOpen(project: ProjectItem) {
    router.push(projectHref(project))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-6">
        <div className="flex items-center gap-8 border-b border-white/10 pb-1">
          <button
            type="button"
            className="relative flex items-center gap-2 pb-3 text-h3 text-fg"
          >
            我的记录
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {KIND_ORDER.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setActiveKind(kind)}
              className="btn-tab"
              data-active={activeKind === kind ? 'true' : 'false'}
            >
              {KIND_LABEL[kind]}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <p className="text-body text-fg3">加载中...</p>
          </div>
        ) : activeProjects.length === 0 ? (
          <div className="flex justify-center py-20">
            <p className="text-body text-fg3">尚未创建该分类项目</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-8">
            {activeProjects.map((project) => (
              <RecordCard
                key={project.id}
                project={project}
                onOpen={() => handleOpen(project)}
                onRename={(newName) => handleRename(project.id, newName)}
                onDelete={() => handleDelete(project.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
