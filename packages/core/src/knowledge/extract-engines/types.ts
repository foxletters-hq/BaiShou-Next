import type { ExtractQuality, PageBoundaryTable } from '../knowledge-extract'

export type ExtractEngineId = 'simple' | 'ocr' | 'vision'

export interface EngineExtractResult {
  text: string
  pages: PageBoundaryTable
  pageCount: number
  textPageCount: number
  quality: ExtractQuality
  evidence?: string
  extractEngine: ExtractEngineId
  textHash: string
  /** 降级说明（请求的引擎不可用时） */
  degradationMessage?: string
  /** 本次实际 OCR/识别过的页码（1-based） */
  processedPages?: number[]
}

export interface PdfPageBitmap {
  page: number
  pngBase64: string
  width: number
  height: number
}

/** 平台注入：逐页渲染 PDF 为位图（200–300 DPI） */
export type PdfPageBitmapRenderer = (opts: {
  absolutePath: string
  /** 1-based；缺省全部页 */
  pageNumbers?: number[]
  dpi?: number
  onProgress?: (info: { page: number; total: number }) => void
}) => Promise<PdfPageBitmap[]>

/** 平台注入：视觉模型识别单页 */
export type VisionPageRecognizer = (opts: {
  pngBase64: string
  page: number
  mediaType?: string
  providerId?: string | null
  modelId?: string | null
}) => Promise<string>

export interface ExtractEngineContext {
  absolutePath: string
  /** 仅处理这些页（1-based）；用于 partial「只 OCR 缺失页」 */
  pageNumbers?: number[]
  /** 已有的按页文本（与 pageNumbers 合并时使用） */
  existingPageTexts?: string[]
  language?: string
  dpi?: number
  /** OCR / vision 并发页数（1–10，默认 3） */
  concurrency?: number
  /** 进度只通知主线程界面，不写入资料。关掉软件后这段进度作废，下次整段重算。 */
  onProgress?: (info: {
    page: number
    total: number
    phase?: 'parse' | 'render' | 'recognize'
  }) => void
  /** 取消提取时中断 */
  signal?: AbortSignal
  /** 默认写入进程内页缓存；试抽传 false，避免污染正式提取 */
  persistCache?: boolean
  visionProviderId?: string | null
  visionModelId?: string | null
}

export interface ExtractEngine {
  id: ExtractEngineId
  extract(ctx: ExtractEngineContext): Promise<EngineExtractResult>
}
