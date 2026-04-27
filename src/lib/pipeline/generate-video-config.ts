import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

type VideoConfig = {
  portrait: {
    v: 1
    path: string
    align: 0 | 8
    has_audio: 0
    f: number
    aFrame: [number, number, number, number]
    rgbFrame: [number, number, number, number]
    videoW: number
    videoH: number
    w: number
    h: number
  }
}

type VideoProbeInfo = {
  width: number
  height: number
  frameCount: number
}

function parseFrameRate(rate: string | undefined): number | null {
  if (!rate || rate === 'N/A') return null
  const [num, den] = rate.split('/').map(Number)
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null
  const fps = num / den
  return Number.isFinite(fps) && fps > 0 ? fps : null
}

async function countFramesWithFfmpeg(videoPath: string): Promise<number> {
  const { stdout, stderr } = await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-vcodec', 'copy',
    '-acodec', 'copy',
    '-f', 'null',
    '-',
  ], { timeout: 120_000 })

  const output = `${stdout}\n${stderr}`
  const matches = [...output.matchAll(/frame=\s*(\d+)/g)]
  const last = matches.at(-1)?.[1]
  const frameCount = last ? Number.parseInt(last, 10) : NaN
  if (!Number.isFinite(frameCount) || frameCount <= 0) {
    throw new Error('无法通过 ffmpeg 统计视频帧数')
  }
  return frameCount
}

async function probeVideo(videoPath: string): Promise<VideoProbeInfo> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,nb_frames,r_frame_rate,duration',
    '-of', 'json',
    videoPath,
  ], { timeout: 60_000 })

  const data = JSON.parse(stdout) as {
    streams?: Array<{
      width?: number
      height?: number
      nb_frames?: string
      r_frame_rate?: string
      duration?: string
    }>
  }

  const stream = data.streams?.[0]
  if (!stream?.width || !stream?.height) {
    throw new Error('ffprobe 未找到有效视频流')
  }

  let frameCount: number | null = null
  if (stream.nb_frames && stream.nb_frames !== 'N/A') {
    const parsed = Number.parseInt(stream.nb_frames, 10)
    if (Number.isFinite(parsed) && parsed > 0) frameCount = parsed
  }

  if (!frameCount && stream.duration && stream.r_frame_rate) {
    const fps = parseFrameRate(stream.r_frame_rate)
    const duration = Number.parseFloat(stream.duration)
    if (fps && Number.isFinite(duration) && duration > 0) {
      frameCount = Math.floor(fps * duration)
    }
  }

  if (!frameCount) {
    frameCount = await countFramesWithFfmpeg(videoPath)
  }

  return {
    width: stream.width,
    height: stream.height,
    frameCount,
  }
}

export async function generateVideoConfig(
  videoBuffer: Buffer,
  filename: string,
): Promise<VideoConfig> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-config-'))
  const videoPath = path.join(tmpDir, filename)

  try {
    await fs.writeFile(videoPath, videoBuffer)
    const info = await probeVideo(videoPath)
    const singleWidth = Math.floor(info.width / 2)
    const singleHeight = info.height
    const align: 0 | 8 = singleWidth % 8 === 0 && singleHeight % 8 === 0 ? 8 : 0

    return {
      portrait: {
        v: 1,
        path: filename,
        align,
        has_audio: 0,
        f: info.frameCount,
        aFrame: [0, 0, singleWidth, singleHeight],
        rgbFrame: [singleWidth, 0, singleWidth, singleHeight],
        videoW: info.width,
        videoH: info.height,
        w: singleWidth,
        h: singleHeight,
      },
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
