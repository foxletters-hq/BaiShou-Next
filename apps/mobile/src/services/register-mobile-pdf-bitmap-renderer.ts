import { registerPdfPageBitmapRenderer } from '@baishou/core-mobile'
import i18n from 'i18next'

/** 注册位图槽位；手机暂不能把 PDF 页画成图，调用时抛错以免静默当成功。 */
export function registerMobilePdfPageBitmapRenderer(): void {
  registerPdfPageBitmapRenderer(async () => {
    throw new Error(
      i18n.t(
        'knowledge.mobile_pdf_bitmap_unavailable',
        '手机暂无 PDF 页位图，扫描件请改用文本层或到桌面做 OCR'
      )
    )
  })
}
