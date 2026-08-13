import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerPdfPageBitmapRenderer } from '@baishou/core-desktop'
import { logger } from '@baishou/shared'

const nodeRequire = createRequire(import.meta.url)

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

type DocCache = {
  absolutePath: string
  doc: PdfDocument
  timer: ReturnType<typeof setTimeout> | null
}

const DOC_IDLE_MS = 15_000
let docCache: DocCache | null = null
let pdfjsPromise: Promise<PdfJsModule> | null = null
/** 同一时刻只允许一次 PDF 渲染，避免并发访问同一 Document */
let renderChain: Promise<unknown> = Promise.resolve()

function withRenderLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = renderChain.then(fn, fn)
  renderChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as PdfJsModule
      try {
        const workerPath = nodeRequire.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
        if (pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
        }
      } catch {
        /* ignore */
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
  if (cached.timer) clearTimeout(cached.timer)
  try {
    await cached.doc.destroy?.()
  } catch {
    /* ignore */
  }
}

function touchDocCache(absolutePath: string, doc: PdfDocument): void {
  if (docCache?.timer) clearTimeout(docCache.timer)
  docCache = {
    absolutePath,
    doc,
    timer: setTimeout(() => {
      void releaseDocCache()
    }, DOC_IDLE_MS)
  }
}

async function getPdfDocument(absolutePath: string): Promise<PdfDocument> {
  if (docCache?.absolutePath === absolutePath) {
    touchDocCache(absolutePath, docCache.doc)
    return docCache.doc
  }
  await releaseDocCache()
  const pdfjs = await loadPdfJs()
  const data = new Uint8Array(fs.readFileSync(absolutePath))
  const doc = await pdfjs.getDocument({
    data,
    disableWorker: true,
    useSystemFonts: true,
    verbosity: 0
  }).promise
  touchDocCache(absolutePath, doc)
  return doc
}

/**
 * 桌面：pdfjs-dist 逐页渲染 PNG（200–300 DPI）供 OCR / vision。
 * canvas（@napi-rs/canvas）为可选依赖；缺失时 capabilities 会标 OCR 不可用。
 * 短时缓存最近打开的 PDF，避免逐页 OCR 反复读盘开文档。
 */
export function registerDesktopPdfPageBitmapRenderer(): void {
  registerPdfPageBitmapRenderer(async (opts) =>
    withRenderLock(async () => {
      const { absolutePath, pageNumbers, dpi = 250 } = opts
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

      const doc = await getPdfDocument(absolutePath)
      const total = doc.numPages
      const targets = pageNumbers?.length
        ? pageNumbers.filter((p) => p >= 1 && p <= total)
        : Array.from({ length: total }, (_, i) => i + 1)

      const scale = Math.max(1, (dpi || 250) / 72)
      const out: Array<{ page: number; pngBase64: string; width: number; height: number }> = []

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
      }

      // 保持文档缓存，供下一页 OCR 复用；空闲后自动 destroy
      touchDocCache(absolutePath, doc)

      logger.info('[PdfBitmap] rendered pages', {
        file: path.basename(absolutePath),
        count: out.length,
        dpi
      })
      return out
    })
  )
}
