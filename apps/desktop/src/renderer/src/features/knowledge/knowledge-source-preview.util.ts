export type PdfPreviewSource = { type: 'url'; url: string } | { type: 'data'; data: Uint8Array }

export type PdfPreviewBytesInput =
  | ArrayBuffer
  | ArrayBufferView
  | { type?: string; data?: number[] }
  | null
  | undefined

/** 把 IPC 回来的 PDF 字节转成 pdf.js 可用的 Uint8Array。 */
export function toPdfPreviewBytes(value: PdfPreviewBytesInput): Uint8Array | null {
  if (!value) return null
  if (value instanceof Uint8Array) {
    return value.byteLength > 0 ? value : null
  }
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView
    if (view.byteLength <= 0) return null
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  }
  if (value instanceof ArrayBuffer) {
    return value.byteLength > 0 ? new Uint8Array(value) : null
  }
  if (typeof value === 'object' && Array.isArray(value.data)) {
    return value.data.length > 0 ? new Uint8Array(value.data) : null
  }
  return null
}

/** 优先走本地协议地址，避免 IPC 整包拷贝；没有地址时才回退字节。 */
export function resolvePdfPreviewSource(input: {
  localUrl?: string | null
  fileBytes?: PdfPreviewBytesInput
}): PdfPreviewSource | null {
  const url = typeof input.localUrl === 'string' ? input.localUrl.trim() : ''
  if (/^local:/i.test(url) || /^file:/i.test(url)) {
    return { type: 'url', url }
  }
  const data = toPdfPreviewBytes(input.fileBytes)
  return data ? { type: 'data', data } : null
}

/** pdf.js 打开参数：按地址分段拉取，先出当前页，不把整份文件再拷进 worker。 */
export function buildPdfJsDocumentParams(source: PdfPreviewSource): Record<string, unknown> {
  if (source.type === 'url') {
    return {
      url: source.url,
      disableRange: false,
      disableStream: false,
      disableAutoFetch: true,
      useWorkerFetch: false
    }
  }
  return { data: source.data.slice() }
}

export const PDF_PREVIEW_SPREAD_GAP = 12
export const PDF_PREVIEW_MIN_PAGE_CSS_WIDTH = 280

/**
 * 容器宽度还没量到时不要画。先按整栏画再改成对开，后完成的那次会把第一页盖成过高的尺寸。
 */
export function resolvePdfPreviewLayout(input: {
  containerWidth: number
  pageWidth: number
  pageCount: number
}): { ready: boolean; useSpread: boolean } {
  if (input.containerWidth <= 0 || input.pageWidth <= 0 || input.pageCount < 1) {
    return { ready: false, useSpread: false }
  }
  return {
    ready: true,
    useSpread: shouldUsePdfBookSpread(input.containerWidth, input.pageWidth) && input.pageCount > 1
  }
}

/** 容器够放下两页可读宽度时，用左右对开。 */
export function shouldUsePdfBookSpread(
  containerWidth: number,
  pageWidth: number,
  minPageCssWidth = PDF_PREVIEW_MIN_PAGE_CSS_WIDTH
): boolean {
  if (containerWidth <= 0 || pageWidth <= 0) return false
  const readable = Math.min(pageWidth, minPageCssWidth)
  return containerWidth >= readable * 2 + PDF_PREVIEW_SPREAD_GAP
}

/** 书本对开：封面单独一页，之后偶数页在左、奇数页在右。 */
export function pdfBookSpreadPages(page: number, pageCount: number): number[] {
  const current = Math.min(Math.max(1, page), Math.max(1, pageCount))
  if (pageCount <= 1 || current <= 1) return [current]
  const left = current % 2 === 0 ? current : current - 1
  if (left + 1 <= pageCount) return [left, left + 1]
  return [left]
}

export function pdfSpreadStep(page: number, pageCount: number, delta: -1 | 1): number {
  const spread = pdfBookSpreadPages(page, pageCount)
  if (delta > 0) {
    return Math.min(pageCount, (spread[spread.length - 1] ?? page) + 1)
  }
  return Math.max(1, (spread[0] ?? page) - 1)
}

export function formatPdfPreviewPageLabel(
  pages: number[],
  pageCount: number
): {
  page: string
  total: number
} {
  const first = pages[0] ?? 1
  const last = pages[pages.length - 1] ?? first
  return {
    page: first === last ? String(first) : `${first} – ${last}`,
    total: pageCount
  }
}

export const PDF_PREVIEW_MIN_SCALE = 0.25
export const PDF_PREVIEW_MAX_SCALE = 4
/** 与官方阅读器相同：每次按 1.1 倍缩放，1 就是原页大小。 */
export const PDF_PREVIEW_SCALE_DELTA = 1.1

export function clampPdfPreviewScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1
  return Math.min(PDF_PREVIEW_MAX_SCALE, Math.max(PDF_PREVIEW_MIN_SCALE, scale))
}

/** 按当前真实比例放大或缩小，不是在「适配后的尺寸」上再乘一档。 */
export function stepPdfPreviewScale(current: number, direction: -1 | 1): number {
  const next =
    direction > 0 ? current * PDF_PREVIEW_SCALE_DELTA : current / PDF_PREVIEW_SCALE_DELTA
  return clampPdfPreviewScale(next)
}

export function resolvePdfPreviewFitScale(input: {
  pageWidth: number
  pageHeight: number
  pageCountInView: number
  availableWidth: number
  availableHeight?: number
  gap?: number
  spreadSlot?: boolean
  fit?: 'page' | 'width'
}): number {
  if (input.pageWidth <= 0 || input.pageHeight <= 0) return 1
  const pages = Math.max(1, input.pageCountInView)
  const slots = input.spreadSlot ? Math.max(2, pages) : pages
  const gap = slots > 1 ? (input.gap ?? PDF_PREVIEW_SPREAD_GAP) : 0
  const usableWidth = Math.max(80, input.availableWidth - gap)
  const widthScale = usableWidth / slots / input.pageWidth
  const heightLimit = input.availableHeight ?? 0
  if (input.fit === 'width' || heightLimit <= 0) return widthScale
  return Math.min(widthScale, heightLimit / input.pageHeight)
}

/**
 * scale = 1 表示原页大小（100%）。
 * 未传入 scale 时按预览区适配；对开时单独一页也按半页宽度排。
 */
export function resolvePdfPreviewPageCssSize(input: {
  pageWidth: number
  pageHeight: number
  pageCountInView: number
  availableWidth: number
  availableHeight?: number
  gap?: number
  spreadSlot?: boolean
  fit?: 'page' | 'width'
  scale?: number
}): { cssWidth: number; cssHeight: number; viewportScale: number } {
  const viewportScale =
    input.scale && input.scale > 0
      ? clampPdfPreviewScale(input.scale)
      : resolvePdfPreviewFitScale(input)
  return {
    cssWidth: input.pageWidth * viewportScale,
    cssHeight: input.pageHeight * viewportScale,
    viewportScale
  }
}

/** 回车或失焦时跳页。非法输入返回 null，超出总页数则停在最后一页。 */
export function parsePdfPreviewPageJump(raw: string, pageCount: number): number | null {
  const text = raw.trim()
  if (!/^\d+$/.test(text) || pageCount < 1) return null
  const page = Number(text)
  if (!Number.isInteger(page) || page < 1) return null
  return Math.min(pageCount, page)
}
