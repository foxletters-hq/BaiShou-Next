import { registerPdfPageBitmapRenderer } from '@baishou/core-desktop'
import { logger } from '@baishou/shared'
import path from 'node:path'
import { renderPdfPagesOffMain } from './pdf-off-main.host'

/**
 * 桌面：把 PDF 逐页渲染放到独立线程。
 * 远程识图之前仍要在本地把页面画成图片；若画在 Electron 主进程，界面会卡死。
 */
export function registerDesktopPdfPageBitmapRenderer(): void {
  registerPdfPageBitmapRenderer(async (opts) => {
    const pages = await renderPdfPagesOffMain({
      absolutePath: opts.absolutePath,
      pageNumbers: opts.pageNumbers,
      dpi: opts.dpi ?? 250,
      onProgress: opts.onProgress
    })
    logger.info('[PdfBitmap] rendered pages', {
      file: path.basename(opts.absolutePath),
      count: pages.length,
      dpi: opts.dpi ?? 250
    })
    return pages
  })
}
