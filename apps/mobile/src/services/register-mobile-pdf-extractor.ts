import {
  registerPdfNumPagesProbe,
  registerPdfPageExtractor,
  registerPdfPageSampleExtractor
} from '@baishou/core-mobile'
import { extractPdfText } from '../utils/mobile-pdf.util'
import { createMobileFileSystem } from './create-mobile-file-system'

function splitPdfPages(text: string): string[] {
  const pages = text
    .split('\f')
    .map((page) => page.replace(/[ \t]+/g, ' ').trim())
  return pages.length > 0 ? pages : [text.trim()]
}

export function registerMobilePdfExtractor(): void {
  const fileSystem = createMobileFileSystem()
  const extractPages = async (filePath: string): Promise<string[]> => {
    const text = await extractPdfText(filePath, fileSystem)
    return splitPdfPages(text)
  }
  registerPdfPageExtractor(extractPages)
  registerPdfPageSampleExtractor(async (filePath, maxPages) => {
    const pages = await extractPages(filePath)
    return pages.slice(0, Math.max(1, maxPages))
  })
  registerPdfNumPagesProbe(async (filePath) => {
    try {
      const pages = await extractPages(filePath)
      return pages.length > 0 ? pages.length : null
    } catch {
      return null
    }
  })
}
