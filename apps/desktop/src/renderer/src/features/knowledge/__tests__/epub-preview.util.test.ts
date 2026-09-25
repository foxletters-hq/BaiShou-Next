import { describe, expect, it } from 'vitest'
import {
  EPUB_PREVIEW_COLUMN_GAP_FALLBACK,
  clampEpubPreviewPage,
  epubPreviewColumnLayout,
  epubPreviewPageCount,
  epubPreviewPageOffset,
  joinEpubPreviewText,
  readEpubPreviewColumnGap
} from '../epub-preview.util'

describe('joinEpubPreviewText', () => {
  it('should drop documents that have no text and keep the rest in order', () => {
    expect(joinEpubPreviewText(['', '  \n', '第一章 视听语言', '\t', '第二章 场面调度'])).toBe(
      '第一章 视听语言\n\n第二章 场面调度'
    )
  })

  it('should return an empty string when every document is blank', () => {
    expect(joinEpubPreviewText(['', '   ', '\n'])).toBe('')
  })
})

describe('epubPreviewColumnLayout', () => {
  it('should keep the turn stride equal to the preview width', () => {
    expect(epubPreviewColumnLayout(420, 32)).toEqual({
      columnWidth: 388,
      columnGap: 32,
      paddingX: 16,
      stride: 420
    })
  })

  it('should return an empty layout before the preview box is measured', () => {
    expect(epubPreviewColumnLayout(0, 32)).toEqual({
      columnWidth: 0,
      columnGap: 0,
      paddingX: 0,
      stride: 0
    })
  })

  it('should shrink the gap when the preview box is narrower than the gutter', () => {
    expect(epubPreviewColumnLayout(40, 32).columnWidth).toBe(20)
    expect(epubPreviewColumnLayout(40, 32).stride).toBe(40)
  })

  it('should keep later pages on the column boundary when the screen is scaled', () => {
    const layout = epubPreviewColumnLayout(800.4, 32, 1.25)
    expect(layout.columnWidth + layout.columnGap).toBeCloseTo(layout.stride)
    expect(layout.columnWidth * 1.25).toBe(Math.round(layout.columnWidth * 1.25))
    expect(layout.columnGap * 1.25).toBe(Math.round(layout.columnGap * 1.25))
    const offset = epubPreviewPageOffset(111, layout.stride, 1.25)
    expect(offset * 1.25).toBe(110 * Math.round(layout.stride * 1.25))
  })
})

describe('epubPreviewPageCount', () => {
  it('should count exact screen widths as whole pages', () => {
    expect(epubPreviewPageCount(840, 420)).toBe(2)
  })

  it('should ignore a subpixel remainder so the last page is not blank', () => {
    expect(epubPreviewPageCount(848, 420)).toBe(2)
  })

  it('should add a page when the last screen still has text', () => {
    expect(epubPreviewPageCount(500, 420)).toBe(2)
  })

  it('should stay on one page when the text is shorter than the preview', () => {
    expect(epubPreviewPageCount(120, 420)).toBe(1)
    expect(epubPreviewPageCount(0, 420)).toBe(1)
    expect(epubPreviewPageCount(800, 0)).toBe(1)
  })
})

describe('clampEpubPreviewPage', () => {
  it('should keep the page inside the measured range', () => {
    expect(clampEpubPreviewPage(0, 4)).toBe(1)
    expect(clampEpubPreviewPage(2.9, 4)).toBe(2)
    expect(clampEpubPreviewPage(9, 4)).toBe(4)
    expect(clampEpubPreviewPage(Number.NaN, 4)).toBe(1)
  })
})

describe('readEpubPreviewColumnGap', () => {
  it('should read the viewport gap variable', () => {
    const el = document.createElement('div')
    el.style.setProperty('--epub-column-gap', '32px')
    document.body.appendChild(el)
    expect(readEpubPreviewColumnGap(el)).toBe(32)
    el.remove()
  })

  it('should fall back when the variable is missing', () => {
    const el = document.createElement('div')
    expect(readEpubPreviewColumnGap(el)).toBe(EPUB_PREVIEW_COLUMN_GAP_FALLBACK)
  })
})
