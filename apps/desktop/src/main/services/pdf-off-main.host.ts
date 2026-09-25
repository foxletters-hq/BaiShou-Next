import createPdfOffMainWorker from './pdf-off-main.worker?nodeWorker'
import type { Worker } from 'node:worker_threads'

type Pending = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

export type PdfWorkerProgress = {
  step: 'parse' | 'render'
  page: number
  total: number
}

type WorkerResponse = {
  id: number
  type?: 'progress' | 'done'
  ok?: boolean
  result?: unknown
  error?: string
  step?: PdfWorkerProgress['step']
  page?: number
  total?: number
}

let worker: Worker | null = null
let seq = 0
let pumping = false
const pending = new Map<number, Pending>()
const progressListeners = new Map<number, (info: PdfWorkerProgress) => void>()
const queue: Array<{ id: number; payload: Record<string, unknown> }> = []

function rejectAll(error: Error): void {
  pumping = false
  queue.length = 0
  progressListeners.clear()
  const items = [...pending.values()]
  pending.clear()
  for (const item of items) item.reject(error)
}

function ensureWorker(): Worker {
  if (worker) return worker
  const next = createPdfOffMainWorker({})
  next.on('message', (message: WorkerResponse) => {
    if (message.type === 'progress') {
      if (message.step === 'parse' || message.step === 'render') {
        progressListeners.get(message.id)?.({
          step: message.step,
          page: message.page ?? 0,
          total: message.total ?? 0
        })
      }
      return
    }
    pumping = false
    progressListeners.delete(message.id)
    const item = pending.get(message.id)
    pending.delete(message.id)
    if (item) {
      if (message.ok) item.resolve(message.result)
      else item.reject(new Error(message.error || 'pdf worker failed'))
    }
    pump()
  })
  next.on('error', (error) => {
    worker = null
    rejectAll(error instanceof Error ? error : new Error(String(error)))
  })
  next.on('exit', (code) => {
    worker = null
    if (pending.size === 0 && queue.length === 0) return
    rejectAll(new Error(`pdf worker exited (${code})`))
  })
  worker = next
  return next
}

function pump(): void {
  if (pumping) return
  const next = queue.shift()
  if (!next) return
  pumping = true
  try {
    ensureWorker().postMessage(next.payload)
  } catch (error) {
    pumping = false
    const item = pending.get(next.id)
    pending.delete(next.id)
    item?.reject(error instanceof Error ? error : new Error(String(error)))
    pump()
  }
}

function request<T>(
  body: Record<string, unknown>,
  onProgress?: (info: PdfWorkerProgress) => void
): Promise<T> {
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, {
      resolve: (value) => resolve(value as T),
      reject
    })
    if (onProgress) progressListeners.set(id, onProgress)
    queue.push({ id, payload: { id, ...body } })
    pump()
  })
}

export function renderPdfPagesOffMain(input: {
  absolutePath: string
  pageNumbers?: number[]
  dpi?: number
  onProgress?: (info: PdfWorkerProgress) => void
}): Promise<Array<{ page: number; pngBase64: string; width: number; height: number }>> {
  return request<{ pages: Array<{ page: number; pngBase64: string; width: number; height: number }> }>(
    {
      op: 'render',
      absolutePath: input.absolutePath,
      pageNumbers: input.pageNumbers,
      dpi: input.dpi
    },
    input.onProgress
  ).then((result) => result.pages)
}

export function extractPdfTextsOffMain(
  filePath: string,
  maxPages?: number,
  onProgress?: (info: PdfWorkerProgress) => void
): Promise<string[]> {
  return request<string[]>({ op: 'text', filePath, maxPages }, onProgress)
}

export function probePdfNumPagesOffMain(filePath: string): Promise<number | null> {
  return request<number | null>({ op: 'probe', filePath })
}
