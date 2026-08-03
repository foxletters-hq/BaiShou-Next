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

/**
 * 桌面：pdfjs-dist 逐页渲染 PNG（200–300 DPI）供 OCR / vision。
 * canvas（@napi-rs/canvas）为可选依赖；缺失时 capabilities 会标 OCR 不可用。
 */
export function registerDesktopPdfPageBitmapRenderer(): void {
  registerPdfPageBitmapRenderer(async ({ absolutePath, pageNumbers, dpi = 250 }) => {
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

    const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as {
      getDocument: (src: unknown) => { promise: Promise<PdfDocument> }
      GlobalWorkerOptions?: { workerSrc: string }
    }

    // Node 侧禁用 worker，避免路径问题
    try {
      const workerPath = nodeRequire.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
      if (pdfjs.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
      }
    } catch {
      /* ignore */
    }

    const data = new Uint8Array(fs.readFileSync(absolutePath))
    const doc = await pdfjs.getDocument({
      data,
      disableWorker: true,
      useSystemFonts: true,
      verbosity: 0
    }).promise

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

    try {
      await doc.destroy?.()
    } catch {
      /* ignore */
    }

    logger.info('[PdfBitmap] rendered pages', {
      file: path.basename(absolutePath),
      count: out.length,
      dpi
    })
    return out
  })
}

interface PdfDocument {
  numPages: number
  getPage: (n: number) => Promise<{
    getViewport: (opts: { scale: number }) => { width: number; height: number }
    render: (opts: { canvasContext: unknown; viewport: unknown }) => { promise: Promise<void> }
  }>
  destroy?: () => Promise<void>
}
