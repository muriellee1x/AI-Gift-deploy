import 'dotenv/config'
import { createImageWorker } from './image.worker'
import { createVideoWorker } from './video.worker'
import { createTextWorker } from './text.worker'

const workers = [createImageWorker(), createVideoWorker(), createTextWorker()]

console.log('[Workers] started:', workers.length)

for (const worker of workers) {
  worker.on('ready', () => {
    console.log(`[Workers] ready: ${worker.name}`)
  })

  worker.on('error', (err) => {
    console.error(`[Workers] error: ${worker.name}`, err.message)
  })

  worker.on('failed', (job, err) => {
    console.error(`[Workers] job failed: ${worker.name}`, {
      jobId: job?.id,
      taskId: job?.data?.taskId,
      taskType: job?.data?.type,
      error: err.message,
    })
  })
}

async function shutdown(signal: string) {
  console.log(`[Workers] shutdown signal: ${signal}`)
  await Promise.all(workers.map(async (worker) => await worker.close()))
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
