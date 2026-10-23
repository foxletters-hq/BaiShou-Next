/** 与主题 --spacing-xl 一致。读不到 CSS 变量时用这个页边。 */
export const EPUB_PREVIEW_COLUMN_GAP_FALLBACK = 32

/** 亚像素和边框余量不算新的一屏，避免末尾多出空白页。 */
export const EPUB_PREVIEW_PAGE_SLOP = 8

/**
 * 预览把有正文的文档接成一篇，再按预览框高度分屏。
 * 封面这类抽完没有文字的文档不占一屏。抽取入库仍保留原来的文档顺序。
 */
export function joinEpubPreviewText(pages: readonly string[]): string {
  return pages
    .map((page) => page.trim())
    .filter((page) => page.length > 0)
    .join('\n\n')
}

export function readEpubPreviewColumnGap(
  element: HTMLElement,
  fallback = EPUB_PREVIEW_COLUMN_GAP_FALLBACK
): number {
  const raw = getComputedStyle(element).getPropertyValue('--epub-column-gap').trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return value
}

/**
 * 栏宽、栏间距和翻页步长都落在整颗屏幕像素上。
 * 系统缩放不是 100% 时，每栏差一丁点，翻到后面就会把字切进下一页。
 */
export function epubPreviewColumnLayout(
  pageWidth: number,
  gap: number,
  devicePixelRatio = 1
): { columnWidth: number; columnGap: number; paddingX: number; stride: number } {
  if (pageWidth <= 0) {
    return { columnWidth: 0, columnGap: 0, paddingX: 0, stride: 0 }
  }
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1
  const viewDevice = Math.floor(pageWidth * dpr)
  const gapDevice = Math.min(Math.round(gap * dpr), Math.floor(viewDevice / 2))
  const evenGap = gapDevice - (gapDevice % 2)
  const columnDevice = viewDevice - evenGap
  return {
    columnWidth: columnDevice / dpr,
    columnGap: evenGap / dpr,
    paddingX: evenGap / 2 / dpr,
    stride: viewDevice / dpr
  }
}

/** 翻页距离按屏幕像素取整，避免页数变多以后浮点误差把栏缝推偏。 */
export function epubPreviewPageOffset(page: number, stride: number, devicePixelRatio = 1): number {
  if (stride <= 0 || page <= 1) return 0
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1
  const strideDevice = Math.round(stride * dpr)
  return ((page - 1) * strideDevice) / dpr
}

export function epubPreviewPageCount(
  scrollWidth: number,
  stride: number,
  slop = EPUB_PREVIEW_PAGE_SLOP
): number {
  if (stride <= 0 || scrollWidth <= 0) return 1
  const full = Math.floor(scrollWidth / stride)
  const remainder = scrollWidth - full * stride
  if (remainder <= slop) return Math.max(1, full)
  return full + 1
}

export function clampEpubPreviewPage(page: number, pageCount: number): number {
  const total = Math.max(1, Math.floor(pageCount) || 1)
  if (!Number.isFinite(page)) return 1
  return Math.min(total, Math.max(1, Math.floor(page)))
}
