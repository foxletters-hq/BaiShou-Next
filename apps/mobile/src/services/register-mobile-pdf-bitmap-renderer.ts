import { getPdfPageRenderNative } from 'expo-pdf-page-render'
import {
  getPdfNumPagesProbe,
  registerPdfNumPagesProbe,
  registerPdfPageBitmapRenderer
} from '@baishou/core-mobile'
import {
  createMobilePdfPageBitmapRenderer,
  normalizePdfFilePath
} from '../utils/mobile-pdf-page-render.util'

/** 注册系统 PDF 页图渲染；页数优先用原生页数，扫描件不会被文字层切成 1 页。 */
export function registerMobilePdfPageBitmapRenderer(): void {
  const previousProbe = getPdfNumPagesProbe()
  registerPdfPageBitmapRenderer(createMobilePdfPageBitmapRenderer(getPdfPageRenderNative))
  registerPdfNumPagesProbe(async (filePath) => {
    const native = getPdfPageRenderNative()
    if (native?.isAvailable()) {
      try {
        const count = await native.getPageCount(normalizePdfFilePath(filePath))
        if (typeof count === 'number' && count > 0) return count
      } catch {
        /* 原生页数失败时退回文字层探测 */
      }
    }
    return previousProbe ? previousProbe(filePath) : null
  })
}
