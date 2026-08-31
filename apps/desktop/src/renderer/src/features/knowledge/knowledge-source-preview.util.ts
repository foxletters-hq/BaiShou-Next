export type PdfPreviewSource =
  | { type: 'url'; url: string }
  | { type: 'data'; data: Uint8Array }

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

export function formatPdfPreviewPageLabel(pages: number[], pageCount: number): {
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

/** 按容器宽度适配当前可见页（page-width），高度超出则由容器滚动。 */
export function resolvePdfPreviewPageCssSize(input: {
  pageWidth: number
  pageHeight: number
  pageCountInView: number
  availableWidth: number
  gap?: number
}): { cssWidth: number; cssHeight: number; viewportScale: number } {
  const pages = Math.max(1, input.pageCountInView)
  const gap = pages > 1 ? (input.gap ?? PDF_PREVIEW_SPREAD_GAP) : 0
  const usable = Math.max(80, input.availableWidth - gap)
  const viewportScale = usable / pages / input.pageWidth
  return {
    cssWidth: input.pageWidth * viewportScale,
    cssHeight: input.pageHeight * viewportScale,
    viewportScale
  }
}
