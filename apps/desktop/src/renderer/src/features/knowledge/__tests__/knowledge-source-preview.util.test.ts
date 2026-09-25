import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildPdfJsDocumentParams,
  formatPdfPreviewPageLabel,
  parsePdfPreviewPageJump,
  pdfBookSpreadPages,
  pdfSpreadStep,
  resolvePdfPreviewLayout,
  resolvePdfPreviewFitScale,
  resolvePdfPreviewPageCssSize,
  stepPdfPreviewScale,
  resolvePdfPreviewSource,
  shouldUsePdfBookSpread,
  toPdfPreviewBytes
} from '../knowledge-source-preview.util'

describe('toPdfPreviewBytes', () => {
  it('returns the same non-empty Uint8Array', () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])
    expect(toPdfPreviewBytes(bytes)).toBe(bytes)
  })

  it('wraps ArrayBuffer and Node Buffer-like views', () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer
    expect(Array.from(toPdfPreviewBytes(buffer) ?? [])).toEqual([1, 2, 3])
    expect(Array.from(toPdfPreviewBytes(new DataView(buffer)) ?? [])).toEqual([1, 2, 3])
  })

  it('accepts IPC Buffer JSON shape', () => {
    expect(Array.from(toPdfPreviewBytes({ type: 'Buffer', data: [9, 8] }) ?? [])).toEqual([9, 8])
  })

  it('returns null for empty or unknown values', () => {
    expect(toPdfPreviewBytes(null)).toBeNull()
    expect(toPdfPreviewBytes(new Uint8Array())).toBeNull()
    expect(toPdfPreviewBytes({ type: 'Buffer', data: [] })).toBeNull()
    expect(toPdfPreviewBytes({} as never)).toBeNull()
  })

  it('prefers a local protocol URL over copied bytes', () => {
    expect(
      resolvePdfPreviewSource({
        localUrl: 'local:///D:/Vault/nb1/cover.pdf',
        fileBytes: new Uint8Array([1, 2, 3])
      })
    ).toEqual({ type: 'url', url: 'local:///D:/Vault/nb1/cover.pdf' })
    expect(
      resolvePdfPreviewSource({
        localUrl: '',
        fileBytes: new Uint8Array([1, 2, 3])
      })
    ).toEqual({ type: 'data', data: new Uint8Array([1, 2, 3]) })
    expect(resolvePdfPreviewSource({ localUrl: 'https://example.test/a.pdf' })).toBeNull()
    expect(
      buildPdfJsDocumentParams({ type: 'url', url: 'local:///D:/Vault/nb1/a.pdf' })
    ).toMatchObject({
      url: 'local:///D:/Vault/nb1/a.pdf',
      disableAutoFetch: true,
      disableRange: false,
      useWorkerFetch: false
    })
  })
})

describe('pdf book spread', () => {
  it('should wait until the container width is known before choosing a layout', () => {
    expect(resolvePdfPreviewLayout({ containerWidth: 0, pageWidth: 400, pageCount: 222 })).toEqual({
      ready: false,
      useSpread: false
    })
    expect(resolvePdfPreviewLayout({ containerWidth: 900, pageWidth: 400, pageCount: 222 })).toEqual(
      {
        ready: true,
        useSpread: true
      }
    )
    expect(resolvePdfPreviewLayout({ containerWidth: 400, pageWidth: 400, pageCount: 222 })).toEqual(
      {
        ready: true,
        useSpread: false
      }
    )
  })

  it('uses two pages only when the container is wide enough', () => {
    expect(shouldUsePdfBookSpread(900, 400)).toBe(true)
    expect(shouldUsePdfBookSpread(400, 400)).toBe(false)
  })

  it('keeps the cover alone and pairs even-left pages', () => {
    expect(pdfBookSpreadPages(1, 238)).toEqual([1])
    expect(pdfBookSpreadPages(2, 238)).toEqual([2, 3])
    expect(pdfBookSpreadPages(3, 238)).toEqual([2, 3])
    expect(pdfBookSpreadPages(238, 238)).toEqual([238])
  })

  it('turns pages by the current spread', () => {
    expect(pdfSpreadStep(1, 238, 1)).toBe(2)
    expect(pdfSpreadStep(3, 238, 1)).toBe(4)
    expect(pdfSpreadStep(3, 238, -1)).toBe(1)
    expect(pdfSpreadStep(2, 238, -1)).toBe(1)
  })

  it('fits visible pages to the container width without stretching height', () => {
    const size = resolvePdfPreviewPageCssSize({
      pageWidth: 400,
      pageHeight: 600,
      pageCountInView: 2,
      availableWidth: 812
    })
    expect(size.cssWidth).toBeCloseTo(400)
    expect(size.cssHeight).toBeCloseTo(600)
    expect(size.viewportScale).toBeCloseTo(1)
  })

  it('should fit the whole page inside the preview height', () => {
    const size = resolvePdfPreviewPageCssSize({
      pageWidth: 400,
      pageHeight: 600,
      pageCountInView: 1,
      availableWidth: 1000,
      availableHeight: 300,
      fit: 'page'
    })
    expect(size.cssWidth).toBeCloseTo(200)
    expect(size.cssHeight).toBeCloseTo(300)
  })

  it('should treat 100% as the original page size', () => {
    const full = resolvePdfPreviewPageCssSize({
      pageWidth: 400,
      pageHeight: 600,
      pageCountInView: 1,
      availableWidth: 200,
      availableHeight: 200,
      scale: 1
    })
    const threeQuarter = resolvePdfPreviewPageCssSize({
      pageWidth: 400,
      pageHeight: 600,
      pageCountInView: 1,
      availableWidth: 200,
      availableHeight: 200,
      scale: 0.75
    })
    expect(full.cssWidth).toBeCloseTo(400)
    expect(full.cssHeight).toBeCloseTo(600)
    expect(threeQuarter.cssWidth).toBeCloseTo(300)
    expect(threeQuarter.cssHeight).toBeCloseTo(450)
    expect(full.cssWidth / threeQuarter.cssWidth).toBeCloseTo(4 / 3)
  })

  it('should step zoom from the current real scale', () => {
    expect(stepPdfPreviewScale(1, 1)).toBeCloseTo(1.1)
    expect(stepPdfPreviewScale(1.1, -1)).toBeCloseTo(1)
    expect(stepPdfPreviewScale(0.25, -1)).toBe(0.25)
    expect(stepPdfPreviewScale(4, 1)).toBe(4)
    expect(resolvePdfPreviewFitScale({
      pageWidth: 400,
      pageHeight: 600,
      pageCountInView: 1,
      availableWidth: 400,
      availableHeight: 600,
      fit: 'page'
    })).toBeCloseTo(1)
  })

  it('should size a lone cover like one page of a spread', () => {
    const cover = resolvePdfPreviewPageCssSize({
      pageWidth: 400,
      pageHeight: 600,
      pageCountInView: 1,
      availableWidth: 812,
      spreadSlot: true
    })
    const pair = resolvePdfPreviewPageCssSize({
      pageWidth: 400,
      pageHeight: 600,
      pageCountInView: 2,
      availableWidth: 812
    })
    expect(cover.cssWidth).toBeCloseTo(pair.cssWidth)
    expect(cover.cssHeight).toBeCloseTo(pair.cssHeight)
    expect(cover.cssHeight).toBeCloseTo(600)
  })

  it('should jump to a page and clamp past the last page', () => {
    expect(parsePdfPreviewPageJump('12', 186)).toBe(12)
    expect(parsePdfPreviewPageJump(' 3 ', 186)).toBe(3)
    expect(parsePdfPreviewPageJump('999', 186)).toBe(186)
    expect(parsePdfPreviewPageJump('0', 186)).toBeNull()
    expect(parsePdfPreviewPageJump('1-3', 186)).toBeNull()
    expect(parsePdfPreviewPageJump('', 186)).toBeNull()
  })

  it('should open the preview without modal motion and keep only the spread', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const preview = readFileSync(join(here, '..', 'KnowledgeSourcePreviewDialog.tsx'), 'utf8')
    const dialog = readFileSync(join(here, '..', 'KnowledgeDialog.tsx'), 'utf8')
    expect(preview).toContain('animation="none"')
    expect(preview).toContain('pdfBookSpreadPages')
    expect(preview).toContain('previewCloseBtn')
    expect(preview).not.toContain('dialogActions')
    expect(preview).not.toContain('preview_fit_page')
    expect(preview).not.toContain('preview_fit_width')
    expect(dialog).toContain("animation?: 'fade' | 'none'")
  })

  it('formats a spread label', () => {
    expect(formatPdfPreviewPageLabel([2, 3], 238)).toEqual({ page: '2 – 3', total: 238 })
    expect(formatPdfPreviewPageLabel([1], 238)).toEqual({ page: '1', total: 238 })
  })
})
