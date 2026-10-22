import i18n from 'i18next'
import type { PdfPageBitmap, PdfPageBitmapRenderer } from '@baishou/core-mobile'

export const MOBILE_PDF_RENDER_DEFAULT_DPI = 200
export const MOBILE_PDF_RENDER_MIN_DPI = 72
export const MOBILE_PDF_RENDER_MAX_DPI = 200

export type NativePdfPageRender = {
  isAvailable(): boolean
  getPageCount(filePath: string): Promise<number>
  renderPages(filePath: string, pageNumbers: number[], dpi: number): Promise<PdfPageBitmap[]>
}

/** 原生 PdfRenderer / PDFKit 要文件系统路径；content:// 原样交给原生。 */
export function normalizePdfFilePath(filePath: string): string {
  const trimmed = filePath.trim()
  if (trimmed.startsWith('content://')) return trimmed
  if (trimmed.startsWith('file://')) return trimmed.slice('file://'.length)
  return trimmed
}

export function clampMobilePdfRenderDpi(dpi?: number): number {
  if (typeof dpi !== 'number' || !Number.isFinite(dpi)) return MOBILE_PDF_RENDER_DEFAULT_DPI
  return Math.min(MOBILE_PDF_RENDER_MAX_DPI, Math.max(MOBILE_PDF_RENDER_MIN_DPI, Math.round(dpi)))
}

export function createMobilePdfPageBitmapRenderer(
  nativeOrGet: NativePdfPageRender | null | (() => NativePdfPageRender | null)
): PdfPageBitmapRenderer {
  const getNative = typeof nativeOrGet === 'function' ? nativeOrGet : () => nativeOrGet
  let chain: Promise<unknown> = Promise.resolve()

  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = chain.then(job, job)
    chain = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  return async (opts) => {
    const native = getNative()
    if (!native?.isAvailable()) {
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.utils.mobile.pdf.page.render.util.L45',
          'PDF 页图需要把原生模块编进开发构建。请执行 pnpm dev:mobile:clear 重编后再识图。'
        )
      )
    }
    const filePath = normalizePdfFilePath(opts.absolutePath)
    if (!filePath) {
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.utils.mobile.pdf.page.render.util.L49',
          'PDF 路径为空，无法渲染页图'
        )
      )
    }
    const dpi = clampMobilePdfRenderDpi(opts.dpi)
    const pageNumbers = opts.pageNumbers?.filter((page) => page >= 1) ?? []
    return enqueue(async () => {
      const pages = await native.renderPages(filePath, pageNumbers, dpi)
      for (let i = 0; i < pages.length; i += 1) {
        opts.onProgress?.({ page: i + 1, total: pages.length })
      }
      return pages
    })
  }
}
