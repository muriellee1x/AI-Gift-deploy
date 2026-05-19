'use client'

import { useMemo, useState } from 'react'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import Dropdown from '@/components/ui/Dropdown'
import GenerateProgressModal from '@/components/ui/GenerateProgressModal'
import MediaFrame from '@/components/ui/MediaFrame'

export type ComposeVideoOption = {
  key: string
  label: string
  url: string
}

export type ComposePipeline = 'postprocessGreen' | 'postprocessGeneral'

export type ComposeBaConfigItem = {
  id: string
  name: string
  roomUrl: string
  isDefault: boolean
  hasCookie: boolean
}

export type ComposeOutput = {
  sourceKey: string
  sourceUrl: string
  sourceLabel: string
  pipeline: ComposePipeline
  bg: { videoUrl: string; videoKey: string; filename: string }
  openClaw: { videoUrl: string; videoKey: string; filename: string }
  configUrl: string
  configKey: string
}

type VideoPairResult = {
  kind: 'video-pair'
  bg: { videoUrl: string; videoKey: string; filename: string }
  openClaw: { videoUrl: string; videoKey: string; filename: string }
  configUrl: string
  configKey: string
}

async function pollTask(taskId: string, onProgress: (value: number) => void) {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const res = await fetch(`/api/tasks/${taskId}`)
    if (!res.ok) throw new Error('轮询任务失败')
    const data = await res.json()
    const task = data.task
    if (typeof task.progress === 'number') onProgress(task.progress)
    if (task.status === 'completed') return (task.result ?? {}) as Record<string, unknown>
    if (task.status === 'failed') throw new Error(task.errorMessage || '任务失败')
  }
}

async function fetchAsBlob(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败: ${res.status}`)
  return res.blob()
}

export default function PostprocessComposeStep({
  videos,
  baConfigs,
  outputs,
  onOutputsChange,
  selectedKeys,
  onSelectedKeysChange,
  pipeline,
  onPipelineChange,
  baConfigId,
  onBaConfigIdChange,
}: {
  videos: ComposeVideoOption[]
  baConfigs: ComposeBaConfigItem[]
  outputs: ComposeOutput[]
  onOutputsChange: (next: ComposeOutput[]) => void
  selectedKeys: string[]
  onSelectedKeysChange: (keys: string[]) => void
  pipeline: ComposePipeline | null
  onPipelineChange: (pipeline: ComposePipeline) => void
  baConfigId: string
  onBaConfigIdChange: (id: string) => void
}) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')

  const roomOptions = useMemo(
    () => [...baConfigs]
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
      .map((room) => ({
        value: room.id,
        label: room.isDefault ? `${room.name}（默认）` : room.name,
      })),
    [baConfigs],
  )

  const selectedVideos = useMemo(
    () => videos.filter((video) => selectedKeys.includes(video.key)),
    [videos, selectedKeys],
  )
  const hasOutputs = outputs.length > 0

  const toggleKey = (key: string) => {
    if (selectedKeys.includes(key)) {
      onSelectedKeysChange(selectedKeys.filter((item) => item !== key))
      return
    }
    onSelectedKeysChange([...selectedKeys, key])
  }

  const handleCompose = async () => {
    if (!pipeline || !baConfigId || selectedVideos.length === 0) return
    setRunning(true)
    setProgress(0)
    try {
      const nextOutputs = [...outputs]
      for (let index = 0; index < selectedVideos.length; index += 1) {
        const video = selectedVideos[index]
        setStatusText(`${index + 1}/${selectedVideos.length} 正在合成：${video.label}`)
        setProgress(0)

        const res = await fetch('/api/pipeline/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: pipeline,
            stage: 'post',
            baConfigId,
            videoKey: video.key,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || '提交失败')
        }

        const { taskId } = await res.json()
        const result = await pollTask(taskId, setProgress)
        const pair = result as unknown as VideoPairResult
        const entry: ComposeOutput = {
          sourceKey: video.key,
          sourceUrl: video.url,
          sourceLabel: video.label,
          pipeline,
          bg: pair.bg,
          openClaw: pair.openClaw,
          configUrl: pair.configUrl,
          configKey: pair.configKey,
        }

        const existingIndex = nextOutputs.findIndex((item) => item.sourceKey === video.key && item.pipeline === pipeline)
        if (existingIndex >= 0) nextOutputs.splice(existingIndex, 1, entry)
        else nextOutputs.push(entry)
        onOutputsChange([...nextOutputs])
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '资产合成失败')
    } finally {
      setRunning(false)
      setProgress(0)
      setStatusText('')
    }
  }

  const handleDownload = async () => {
    try {
      const zip = new JSZip()
      for (const output of outputs) {
        const safeName = output.sourceLabel.replace(/[\\/:*?"<>|]/g, '_')
        const folder = zip.folder(safeName) || zip
        const [openClawBlob, configBlob] = await Promise.all([
          fetchAsBlob(output.openClaw.videoUrl),
          fetchAsBlob(output.configUrl),
        ])
        folder.file('config.json', configBlob)
        folder.file('output.mp4', openClawBlob)
      }
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, '资产合成-results.zip')
    } catch (err) {
      alert(err instanceof Error ? err.message : '打包下载失败')
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="text-left">
          <h2 className="text-h3">资产合成</h2>
          <p className="mt-2 text-14px text-fg3">
            {hasOutputs
              ? '查看资产合成结果，并打包下载所有后处理产物。'
              : '选择要处理的视频、后处理管线和 BA 房间，串行执行合成并展示结果。'}
          </p>
        </div>

        {!hasOutputs ? (
          <>
            <div className="content-card p-6">
              <p className="mb-4 text-h4">1. 选择需要合成的文件</p>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {videos.map((video) => {
                  const checked = selectedKeys.includes(video.key)
                  return (
                    <button
                      key={video.key}
                      type="button"
                      onClick={() => toggleKey(video.key)}
                      className={`content-card p-4 text-left ${checked ? 'border-[color:var(--color-brand-2)] bg-[rgba(13,109,255,0.08)]' : ''}`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-h4">{video.label}</p>
                        <span className={`chip ${checked ? '!bg-[rgba(13,109,255,0.2)] !text-[color:var(--color-brand-2)]' : 'bg-white/10 text-fg3'}`}>
                          {checked ? '已选择' : '点击选择'}
                        </span>
                      </div>
                      <MediaFrame type="video" src={video.url} alt={video.label} heightClassName="h-[240px]" />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
              <div className="content-card p-6">
                <p className="mb-4 text-h4">2. 资产合成管线</p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { value: 'postprocessGreen', label: '扣绿后处理' },
                    { value: 'postprocessGeneral', label: '高价效通用后处理' },
                  ].map((item) => {
                    const active = pipeline === item.value
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => onPipelineChange(item.value as ComposePipeline)}
                        className={`btn-tab ${active ? '' : 'opacity-80'}`}
                        data-active={active ? 'true' : 'false'}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="content-card p-6">
                <p className="mb-4 text-h4">3. BA 房间</p>
                <Dropdown
                  value={baConfigId}
                  onChange={onBaConfigIdChange}
                  options={roomOptions}
                  placeholder="请选择 BA 房间"
                  buttonClassName="!h-11"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCompose}
                disabled={running || !pipeline || !baConfigId || selectedVideos.length === 0}
                className="btn-gradient"
              >
                开始合成
              </button>
            </div>
          </>
        ) : null}

        {outputs.length > 0 ? (
          <div className="space-y-6">
            {outputs.map((output) => (
              <div key={`${output.pipeline}-${output.sourceKey}`} className="content-card p-6">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div>
                    <p className="mb-4 text-h4">直播间效果</p>
                    <MediaFrame type="video" src={output.bg.videoUrl} alt="BGOutput" heightClassName="h-[500px]" />
                  </div>
                  <div>
                    <p className="mb-4 text-h4">可上线资产</p>
                    <MediaFrame
                      type="video"
                      src={output.openClaw.videoUrl}
                      alt="OpenClawOutput"
                      heightClassName="h-[500px]"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <button type="button" onClick={handleDownload} className="btn-gradient">
                打包下载
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <GenerateProgressModal
        open={running}
        title="资产合成中"
        progress={progress}
        statusText={statusText}
        showProgressBar
      />
    </>
  )
}
