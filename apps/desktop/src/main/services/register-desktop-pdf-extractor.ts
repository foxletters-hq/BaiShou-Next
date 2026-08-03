import { createRequire } from 'node:module'
import fs from 'node:fs'
import { registerPdfPageExtractor } from '@baishou/core-desktop'

const nodeRequire = createRequire(import.meta.url)

/**
 * 桌面端：用 pdf-parse 的 pagerender 按页抽取文本层。
 */
export function registerDesktopPdfPageExtractor(): void {
  registerPdfPageExtractor(async (filePath: string) => {
    const pdfParse = nodeRequire('pdf-parse') as (
      buffer: Buffer,
      options?: { pagerender?: (pageData: unknown) => Promise<string> }
    ) => Promise<{ text?: string; numpages?: number }>

    const dataBuffer = fs.readFileSync(filePath)
    const pageTexts: string[] = []

    await pdfParse(dataBuffer, {
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
          const pageText = strings.join(' ').replace(/[ \t]+/g, ' ').trim()
          pageTexts.push(pageText)
          return pageText
        } catch {
          pageTexts.push('')
          return ''
        }
      }
    })

    if (pageTexts.length === 0) {
      const fallback = nodeRequire('pdf-parse') as (buffer: Buffer) => Promise<{ text?: string }>
      const data = await fallback(dataBuffer)
      const text = (data.text || '').trim()
      return text ? [text] : []
    }

    return pageTexts
  })
}
