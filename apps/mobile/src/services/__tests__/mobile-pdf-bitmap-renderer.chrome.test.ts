import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))

describe('mobile pdf page bitmap renderer chrome', () => {
  it('should register a native page renderer instead of throwing a missing-bitmap stub', () => {
    const register = readFileSync(join(dir, '..', 'register-mobile-pdf-bitmap-renderer.ts'), 'utf8')
    expect(register).toContain('createMobilePdfPageBitmapRenderer')
    expect(register).toContain('getPdfPageRenderNative')
    expect(register).toContain('registerPdfNumPagesProbe')
    expect(register).not.toContain('手机暂无 PDF 页位图')
  })

  it('should render PDF pages with the system renderer and a white background', () => {
    const kotlin = readFileSync(
      join(
        dir,
        '../../../modules/expo-pdf-page-render/android/src/main/java/expo/modules/pdfpagerender/ExpoPdfPageRenderModule.kt'
      ),
      'utf8'
    )
    const swift = readFileSync(
      join(dir, '../../../modules/expo-pdf-page-render/ios/ExpoPdfPageRenderModule.swift'),
      'utf8'
    )
    expect(kotlin).toContain('PdfRenderer')
    expect(kotlin).toContain('RENDER_MODE_FOR_DISPLAY')
    expect(kotlin).toContain('Color.WHITE')
    expect(kotlin).toContain('pageNum - 1')
    expect(kotlin).toContain('pngBase64')
    expect(swift).toContain('PDFKit')
    expect(swift).toContain('UIColor.white')
    expect(swift).toContain('pageNum - 1')
    expect(swift).toContain('pngData')
  })
})
