import { createRequire } from 'node:module'
import fs from 'node:fs'
import { registerPdfNumPagesProbe, registerPdfPageExtractor } from '@baishou/core-desktop'

const nodeRequire = createRequire(import.meta.url)

async function probePdfNumPages(filePath: string): Promise<number | null> {
  try {
    const pdfParse = nodeRequire('pdf-parse') as (
      buffer: Buffer
    ) => Promise<{ numpages?: number; numPages?: number }>
    const data = await pdfParse(fs.readFileSync(filePath))
    const n = Number(data.numpages ?? data.numPages ?? 0)
    return n > 0 ? n : null
  } catch {
    return null
  }
}

/**
 * 桌面端：用 pdf-parse 的 pagerender 按页抽取文本层；并注册 numPages probe。
 */
export function registerDesktopPdfPageExtractor(): void {
  registerPdfNumPagesProbe(probePdfNumPages)

  registerPdfPageExtractor(async (filePath: string) => {
    const pdfParse = nodeRequire('pdf-parse') as (
      buffer: Buffer,
      options?: { pagerender?: (pageData: unknown) => Promise<string> }
    ) => Promise<{ text?: string; numpages?: number; numPages?: number }>

    const dataBuffer = fs.readFileSync(filePath)
    const pageTexts: string[] = []

    const parsed = await pdfParse(dataBuffer, {
      pagerender: async (pageData: unknown) => {
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
          return pageText
        } catch {
          pageTexts.push('')
          return ''
        }
      }
    })

    const numPages = Number(parsed.numpages ?? parsed.numPages ?? 0)
    if (pageTexts.length === 0) {
      const fallback = nodeRequire('pdf-parse') as (
        buffer: Buffer
      ) => Promise<{ text?: string; numpages?: number }>
      const data = await fallback(dataBuffer)
      const text = (data.text || '').trim()
      const n = Number(data.numpages ?? numPages ?? 0)
      if (n > 0) {
        const pages = Array.from({ length: n }, () => '')
        if (text) pages[0] = text
        return pages
      }
      return text ? [text] : []
    }

    // 用官方 numPages 补齐空页，避免页数未知
    while (numPages > 0 && pageTexts.length < numPages) pageTexts.push('')
    return pageTexts
  })
}
