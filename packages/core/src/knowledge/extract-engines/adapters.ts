import { resolveTesseractNodeWorkerPath } from './tesseract-worker-path.util'
import type { PdfPageBitmapRenderer, VisionPageRecognizer } from './types'

let pdfPageBitmapRenderer: PdfPageBitmapRenderer | null = null
let visionPageRecognizer: VisionPageRecognizer | null = null
/** 探测 PDF 总页数（pdf-parse numpages / pdfjs numPages） */
let pdfNumPagesProbe: ((absolutePath: string) => Promise<number | null>) | null = null

/** tesseract.js 是否已被探测为可加载（缓存） */
let tesseractProbe: { ok: boolean; reason?: string } | null = null

export function registerPdfPageBitmapRenderer(fn: PdfPageBitmapRenderer | null): void {
  pdfPageBitmapRenderer = fn
}

export function getPdfPageBitmapRenderer(): PdfPageBitmapRenderer | null {
  return pdfPageBitmapRenderer
}

export function registerPdfNumPagesProbe(
  fn: ((absolutePath: string) => Promise<number | null>) | null
): void {
  pdfNumPagesProbe = fn
}

export function getPdfNumPagesProbe(): ((absolutePath: string) => Promise<number | null>) | null {
  return pdfNumPagesProbe
}

/** 页数未知时优先用 probe；仍未知返回 null（调用方须保持 needs_ocr） */
export async function resolvePdfNumPages(
  absolutePath: string,
  existingPageCount: number
): Promise<number | null> {
  if (existingPageCount > 0) return existingPageCount
  if (!pdfNumPagesProbe) return null
  try {
    const n = await pdfNumPagesProbe(absolutePath)
    if (typeof n === 'number' && n > 0) return n
  } catch {
    /* ignore */
  }
  return null
}

export function registerVisionPageRecognizer(fn: VisionPageRecognizer | null): void {
  visionPageRecognizer = fn
}

export function getVisionPageRecognizer(): VisionPageRecognizer | null {
  return visionPageRecognizer
}

export function resetTesseractProbeCache(): void {
  tesseractProbe = null
}

export function getCachedTesseractProbe(): { ok: boolean; reason?: string } | null {
  return tesseractProbe
}

export function setCachedTesseractProbe(value: { ok: boolean; reason?: string }): void {
  tesseractProbe = value
}

/**
 * 动态探测 tesseract.js（可选依赖）。失败不抛，供 capabilities 与引擎降级。
 */
export async function probeTesseractJs(): Promise<{ ok: boolean; reason?: string }> {
  if (tesseractProbe) return tesseractProbe
  try {
    // 动态 import：未安装时不影响默认启动
    const mod = await import(/* @vite-ignore */ 'tesseract.js')
    if (!mod?.createWorker && !(mod as { default?: unknown }).default) {
      tesseractProbe = { ok: false, reason: 'tesseract.js 模块不完整' }
      return tesseractProbe
    }
    if (!resolveTesseractNodeWorkerPath()) {
      tesseractProbe = {
        ok: false,
        reason: 'tesseract.js worker-script 未找到，无法启动 OCR 工作线程'
      }
      return tesseractProbe
    }
    tesseractProbe = { ok: true }
    return tesseractProbe
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    tesseractProbe = {
      ok: false,
      reason: `tesseract.js 不可用：${msg}`
    }
    return tesseractProbe
  }
}
