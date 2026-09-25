import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parentPort } from 'node:worker_threads'

const nodeRequire = createRequire(import.meta.url)
const PDF_PROBE_STOP = 'pdf-probe-stop'

type CanvasModule = {
  createCanvas: (
    width: number,
    height: number
  ) => {
    width: number
    height: number
    getContext: (type: '2d') => unknown
    toBuffer: (mime?: string) => Buffer
  }
}

interface PdfDocument {
  numPages: number
  getPage: (n: number) => Promise<{
    getViewport: (opts: { scale: number }) => { width: number; height: number }
    render: (opts: { canvasContext: unknown; viewport: unknown }) => { promise: Promise<void> }
  }>
  destroy?: () => Promise<void>
}

type PdfJsModule = {
  getDocument: (src: unknown) => { promise: Promise<PdfDocument> }
  GlobalWorkerOptions?: { workerSrc: string }
}

type RenderResult = {
  page: number
  pngBase64: string
  width: number
  height: number
}

type WorkerRequest =
  | { id: number; op: 'render'; absolutePath: string; pageNumbers?: number[]; dpi?: number }
  | { id: number; op: 'text'; filePath: string; maxPages?: number }
  | { id: number; op: 'probe'; filePath: string }

if (!parentPort) {
  throw new Error('pdf worker requires parentPort')
}

const port = parentPort

let pdfjsPromise: Promise<PdfJsModule> | null = null
let docCache: { absolutePath: string; doc: PdfDocument } | null = null

function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as PdfJsModule
      try {
        const workerPath = nodeRequire.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
        if (pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
        }
      } catch {
        /* 这个线程里已经关掉 pdf.js 自带 worker */
      }
      return pdfjs
    })()
  }
  return pdfjsPromise
}

async function releaseDocCache(): Promise<void> {
  const cached = docCache
  docCache = null
  if (!cached) return
  try {
    await cached.doc.destroy?.()
  } catch {
    /* ignore */
  }
}

async function getPdfDocument(absolutePath: string): Promise<PdfDocument> {
  if (docCache?.absolutePath === absolutePath) return docCache.doc
  await releaseDocCache()
  const pdfjs = await loadPdfJs()
  const data = new Uint8Array(await fs.readFile(absolutePath))
  const doc = await pdfjs.getDocument({
    data,
    disableWorker: true,
    useSystemFonts: true,
    verbosity: 0
  }).promise
  docCache = { absolutePath, doc }
  return doc
}

function reportProgress(
  id: number,
  step: 'parse' | 'render',
  page: number,
  total: number
): void {
  port.postMessage({ id, type: 'progress', step, page, total })
}

async function renderPages(
  input: {
    id: number
    absolutePath: string
    pageNumbers?: number[]
    dpi?: number
  }
): Promise<RenderResult[]> {
  let canvasMod: CanvasModule
  try {
    canvasMod = nodeRequire('@napi-rs/canvas') as CanvasModule
  } catch {
    try {
      canvasMod = nodeRequire('canvas') as CanvasModule
    } catch (e) {
      throw new Error(
        `PDF 位图渲染需要 @napi-rs/canvas 或 canvas：${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const doc = await getPdfDocument(input.absolutePath)
  const total = doc.numPages
  const targets = input.pageNumbers?.length
    ? input.pageNumbers.filter((page) => page >= 1 && page <= total)
    : Array.from({ length: total }, (_, index) => index + 1)
  const scale = Math.max(1, (input.dpi || 250) / 72)
  const out: RenderResult[] = []

  for (const pageNum of targets) {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const canvas = canvasMod.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const context = canvas.getContext('2d')
    await page.render({
      canvasContext: context as never,
      viewport
    }).promise
    const buf = canvas.toBuffer('image/png')
    out.push({
      page: pageNum,
      pngBase64: buf.toString('base64'),
      width: canvas.width,
      height: canvas.height
    })
    reportProgress(input.id, 'render', out.length, targets.length)
  }

  return out
}

async function extractTexts(
  id: number,
  filePath: string,
  maxPages?: number
): Promise<string[]> {
  const pdfParse = nodeRequire('pdf-parse') as (
    buffer: Buffer,
    options?: { pagerender?: (pageData: unknown) => Promise<string> }
  ) => Promise<{ text?: string; numpages?: number; numPages?: number }>

  const dataBuffer = await fs.readFile(filePath)
  const pageTexts: string[] = []
  const limit = maxPages && maxPages > 0 ? maxPages : Number.POSITIVE_INFINITY

  try {
    const parsed = await pdfParse(dataBuffer, {
      pagerender: async (pageData: unknown) => {
        if (pageTexts.length >= limit) throw new Error(PDF_PROBE_STOP)
        try {
          const page = pageData as {
            getTextContent: () => Promise<{ items?: Array<{ str?: string }> }>
          }
          const textContent = await page.getTextContent()
          const strings: string[] = []
          for (const item of textContent.items ?? []) {
            if (item && typeof item.str === 'string') strings.push(item.str)
          }
          const pageText = strings
            .join(' ')
            .replace(/[ \t]+/g, ' ')
            .trim()
          pageTexts.push(pageText)
          reportProgress(id, 'parse', pageTexts.length, 0)
          return pageText
        } catch (error) {
          if (error instanceof Error && error.message === PDF_PROBE_STOP) throw error
          pageTexts.push('')
          return ''
        }
      }
    })

    const numPages = Number(parsed.numpages ?? parsed.numPages ?? 0)
    if (pageTexts.length === 0) {
      const text = (parsed.text || '').trim()
      const n = Number(parsed.numpages ?? numPages ?? 0)
      if (n > 0) {
        const pages = Array.from(
          { length: Math.min(n, Number.isFinite(limit) ? limit : n) },
          () => ''
        )
        if (text) pages[0] = text
        return pages
      }
      return text ? [text] : []
    }

    if (!Number.isFinite(limit)) {
      while (numPages > 0 && pageTexts.length < numPages) pageTexts.push('')
    }
    return pageTexts.slice(0, Number.isFinite(limit) ? limit : pageTexts.length)
  } catch (error) {
    if (error instanceof Error && error.message === PDF_PROBE_STOP) {
      return pageTexts.slice(0, Number.isFinite(limit) ? limit : pageTexts.length)
    }
    throw error
  }
}

async function probePages(filePath: string): Promise<number | null> {
  try {
    const pdfParse = nodeRequire('pdf-parse') as (
      buffer: Buffer
    ) => Promise<{ numpages?: number; numPages?: number }>
    const data = await pdfParse(await fs.readFile(filePath))
    const n = Number(data.numpages ?? data.numPages ?? 0)
    return n > 0 ? n : null
  } catch {
    return null
  }
}

async function dispatch(message: WorkerRequest): Promise<unknown> {
  if (message.op === 'render') {
    const pages = await renderPages(message)
    return { file: path.basename(message.absolutePath), pages }
  }
  if (message.op === 'text') return extractTexts(message.id, message.filePath, message.maxPages)
  return probePages(message.filePath)
}

let chain: Promise<void> = Promise.resolve()

port.on('message', (message: WorkerRequest) => {
  chain = chain.then(async () => {
    try {
      const result = await dispatch(message)
      port.postMessage({ id: message.id, type: 'done', ok: true, result })
    } catch (error) {
      port.postMessage({
        id: message.id,
        type: 'done',
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  })
})
