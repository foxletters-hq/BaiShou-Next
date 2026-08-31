import { isGarbledExtractText } from '@baishou/shared'
import { md5Hex } from '../fs/md5'

/** 页边界偏移表（D12 L2） */
export interface PageBoundaryTable {
  pages: Array<{ page: number; start: number; end: number }>
}

export type ExtractQuality = 'ok' | 'partial' | 'needs_ocr'

export interface ExtractPageInfo {
  page: number
  text: string
  charCount: number
  hasTextLayer: boolean
}

export interface ExtractResult {
  text: string
  pages: PageBoundaryTable
  pageCount: number
  textPageCount: number
  quality: ExtractQuality
  /** 人类可读证据，例如「112 页中有 98 页没有文本层」 */
  evidence?: string
  extractEngine: 'simple' | 'ocr' | 'vision'
  textHash: string
  degradationMessage?: string
  processedPages?: number[]
}

/** 单页判定「有文本层」的最小字符数（过滤页眉页脚水印） */
export const MIN_TEXT_LAYER_CHARS = 50

export function pageTextNeedsOcr(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < MIN_TEXT_LAYER_CHARS) return true
  return isGarbledExtractText(trimmed)
}

/** 有文本层页占比阈值 */
export const OK_TEXT_PAGE_RATIO = 0.9
export const PARTIAL_TEXT_PAGE_RATIO = 0.1

export function classifyExtractQuality(
  pageCount: number,
  textPageCount: number
): { quality: ExtractQuality; evidence?: string } {
  if (pageCount <= 0) {
    return { quality: 'needs_ocr', evidence: '无法解析页数或文档为空' }
  }
  const missing = pageCount - textPageCount
  const ratio = textPageCount / pageCount
  const evidence = missing > 0 ? `${pageCount} 页中有 ${missing} 页没有文本层` : undefined

  if (ratio >= OK_TEXT_PAGE_RATIO) return { quality: 'ok', evidence }
  if (ratio >= PARTIAL_TEXT_PAGE_RATIO) return { quality: 'partial', evidence }
  return { quality: 'needs_ocr', evidence: evidence ?? `${pageCount} 页几乎无文本层` }
}

export function buildPageBoundaryTable(pageTexts: string[]): PageBoundaryTable {
  const pages: PageBoundaryTable['pages'] = []
  let offset = 0
  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i] ?? ''
    const start = offset
    const end = start + text.length
    pages.push({ page: i + 1, start, end })
    offset = end
    // 页间用双换行拼接时，边界按拼接后文本计算，见 joinPageTexts
  }
  return { pages }
}

/** 拼接页文本；页间 `\n\n`，并同步调整 pages 边界 */
export function joinPageTexts(pageTexts: string[]): {
  text: string
  pages: PageBoundaryTable
} {
  const pages: PageBoundaryTable['pages'] = []
  let text = ''
  for (let i = 0; i < pageTexts.length; i++) {
    const pageText = pageTexts[i] ?? ''
    if (i > 0) text += '\n\n'
    const start = text.length
    text += pageText
    const end = text.length
    pages.push({ page: i + 1, start, end })
  }
  return { text, pages: { pages } }
}

export function analyzePageTexts(pageTexts: string[]): ExtractResult {
  const infos: ExtractPageInfo[] = pageTexts.map((t, i) => {
    const trimmed = t.trim()
    return {
      page: i + 1,
      text: t,
      charCount: trimmed.length,
      hasTextLayer: !pageTextNeedsOcr(t)
    }
  })
  const pageCount = infos.length
  const textPageCount = infos.filter((p) => p.hasTextLayer).length
  const { quality, evidence } = classifyExtractQuality(pageCount, textPageCount)
  const { text, pages } = joinPageTexts(pageTexts)
  return {
    text,
    pages,
    pageCount,
    textPageCount,
    quality,
    evidence,
    extractEngine: 'simple',
    textHash: md5Hex(text)
  }
}

/** 平台注入的按页 PDF 抽取（桌面用 pdf-parse pagerender） */
export type PdfPageExtractor = (filePath: string) => Promise<string[]>

let pdfPageExtractor: PdfPageExtractor | null = null

export function registerPdfPageExtractor(fn: PdfPageExtractor | null): void {
  pdfPageExtractor = fn
}

export type PdfPageSampleExtractor = (filePath: string, maxPages: number) => Promise<string[]>

let pdfPageSampleExtractor: PdfPageSampleExtractor | null = null

export function registerPdfPageSampleExtractor(fn: PdfPageSampleExtractor | null): void {
  pdfPageSampleExtractor = fn
}

export async function probePdfPageTexts(filePath: string, maxPages = 12): Promise<string[]> {
  if (pdfPageSampleExtractor) {
    return pdfPageSampleExtractor(filePath, maxPages)
  }
  const pages = await extractPdfPageTexts(filePath)
  return pages.slice(0, Math.max(1, maxPages))
}

export type EpubPageExtractor = (filePath: string) => Promise<string[]>

let epubPageExtractor: EpubPageExtractor | null = null

export function registerEpubPageExtractor(fn: EpubPageExtractor | null): void {
  epubPageExtractor = fn
}

export async function extractEpubPageTextsFromPath(filePath: string): Promise<string[]> {
  if (!epubPageExtractor) {
    throw new Error('EPUB extractor not registered')
  }
  return epubPageExtractor(filePath)
}

export async function extractEpubFromPath(filePath: string): Promise<ExtractResult> {
  const pageTexts = await extractEpubPageTextsFromPath(filePath)
  return { ...analyzePageTexts(pageTexts), extractEngine: 'simple' }
}

export async function extractMarkdownOrText(content: string): Promise<ExtractResult> {
  const text = content.replace(/\r\n/g, '\n')
  const pages = buildPageBoundaryTable([text])
  // 修正单页 end
  if (pages.pages[0]) pages.pages[0].end = text.length
  const hasText = text.trim().length >= MIN_TEXT_LAYER_CHARS
  return {
    text,
    pages,
    pageCount: 1,
    textPageCount: hasText ? 1 : 0,
    quality: hasText ? 'ok' : 'needs_ocr',
    evidence: hasText ? undefined : '文本内容过短或为空',
    extractEngine: 'simple',
    textHash: md5Hex(text)
  }
}

/** 仅返回按页文本（供 OCR 引擎合并缺失页） */
export async function extractPdfPageTexts(filePath: string): Promise<string[]> {
  if (!pdfPageExtractor) {
    throw new Error('PDF page extractor not registered')
  }
  return pdfPageExtractor(filePath)
}

export async function extractPdfFromPath(filePath: string): Promise<ExtractResult> {
  const pageTexts = await extractPdfPageTexts(filePath)
  if (pageTexts.length === 0) {
    return {
      text: '',
      pages: { pages: [] },
      pageCount: 0,
      textPageCount: 0,
      quality: 'needs_ocr',
      evidence: 'PDF 未能解析出任何页',
      extractEngine: 'simple',
      textHash: md5Hex('')
    }
  }
  try {
    const { rememberSimplePageTexts } = await import('./extract-engines/simple-page-cache')
    rememberSimplePageTexts(filePath, pageTexts)
  } catch {
    /* optional cache */
  }
  return analyzePageTexts(pageTexts)
}

export async function extractSourceContent(options: {
  kind: 'file' | 'text' | string
  /** 文件扩展名小写，含点，如 .pdf */
  ext?: string
  /** 绝对路径（file） */
  absolutePath?: string
  /** 粘贴 / md / txt 正文 */
  textContent?: string
}): Promise<ExtractResult> {
  if (options.kind === 'text') {
    return extractMarkdownOrText(options.textContent ?? '')
  }

  const ext = (options.ext ?? '').toLowerCase()
  if (ext === '.md' || ext === '.txt' || ext === '.markdown') {
    if (options.textContent != null) {
      return extractMarkdownOrText(options.textContent)
    }
    throw new Error('md/txt extract requires textContent')
  }

  if (ext === '.pdf') {
    if (!options.absolutePath) throw new Error('pdf extract requires absolutePath')
    return extractPdfFromPath(options.absolutePath)
  }

  if (ext === '.epub') {
    if (!options.absolutePath) throw new Error('epub extract requires absolutePath')
    return extractEpubFromPath(options.absolutePath)
  }

  throw new Error(`Unsupported source type for extract: kind=${options.kind} ext=${ext}`)
}
