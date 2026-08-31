import { describe, expect, it } from 'vitest'
import {
  buildPdfJsDocumentParams,
  formatPdfPreviewPageLabel,
  pdfBookSpreadPages,
  pdfSpreadStep,
  resolvePdfPreviewPageCssSize,
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

  it('formats a spread label', () => {
    expect(formatPdfPreviewPageLabel([2, 3], 238)).toEqual({ page: '2 – 3', total: 238 })
    expect(formatPdfPreviewPageLabel([1], 238)).toEqual({ page: '1', total: 238 })
  })
})
