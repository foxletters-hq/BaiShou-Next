import fs from 'node:fs/promises'
import {
  extractEpubPageTexts,
  registerEpubPageExtractor,
  registerPdfNumPagesProbe,
  registerPdfPageExtractor,
  registerPdfPageSampleExtractor
} from '@baishou/core-desktop'
import { extractPdfTextsOffMain, probePdfNumPagesOffMain } from './pdf-off-main.host'

/**
 * 桌面端：PDF 文本层和页数探测都在独立线程里做。
 * 同步读整份 PDF 会堵住主进程，远程识图还没开始界面就已经不动了。
 */
export function registerDesktopPdfPageExtractor(): void {
  registerPdfNumPagesProbe((filePath) => probePdfNumPagesOffMain(filePath))
  registerPdfPageExtractor((filePath, onProgress) =>
    extractPdfTextsOffMain(filePath, undefined, (info) => {
      if (info.step === 'parse') onProgress?.({ page: info.page, total: info.total })
    })
  )
  registerPdfPageSampleExtractor((filePath, maxPages) =>
    extractPdfTextsOffMain(filePath, maxPages)
  )
  registerEpubPageExtractor(async (filePath) => extractEpubPageTexts(await fs.readFile(filePath)))
}
