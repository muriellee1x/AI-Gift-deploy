import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

export type ExtractedFrame = {
  dataUrl: string
  timestampSec: number
}

export type ExtractFramesResult = {
  frames: ExtractedFrame[]
  durationSec: number
  targetFps: number
}

async function getVideoDuration(inputPath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    inputPath,
  ])
  const dur = parseFloat(stdout.trim())
  if (isNaN(dur) || dur <= 0) throw new Error(`ffprobe 无法获取视频时长: ${stdout.trim()}`)
  return dur
}

export async function extractFrames(
  videoBuffer: Buffer,
  options: { fps?: number; maxFrames?: number } = {},
): Promise<ExtractFramesResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vframes-'))
  const inputPath = path.join(tmpDir, 'input.mp4')
  const outputPattern = path.join(tmpDir, 'frame_%03d.jpg')
  const desiredFps = options.fps ?? 6
  const maxFrames = options.maxFrames ?? 90

  try {
    await fs.writeFile(inputPath, videoBuffer)

    const durationSec = await getVideoDuration(inputPath)
    const desiredFrameCount = Math.max(1, Math.floor(durationSec * desiredFps))
    const targetFps = desiredFrameCount > maxFrames
      ? maxFrames / durationSec
      : desiredFps

    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vf', `fps=${targetFps}`,
      '-q:v', '3',
      '-f', 'image2',
      outputPattern,
    ], { timeout: 120_000 })

    const files = (await fs.readdir(tmpDir))
      .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'))
      .sort()

    if (files.length === 0) {
      throw new Error('ffmpeg 未能提取任何帧')
    }

    const frames: ExtractedFrame[] = []
    for (const file of files.slice(0, maxFrames)) {
      const buf = await fs.readFile(path.join(tmpDir, file))
      const match = file.match(/frame_(\d+)\.jpg$/)
      const index = match ? Number.parseInt(match[1], 10) - 1 : frames.length
      frames.push({
        dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}`,
        timestampSec: Number((index / targetFps).toFixed(2)),
      })
    }

    return {
      frames,
      durationSec,
      targetFps: Number(targetFps.toFixed(4)),
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
