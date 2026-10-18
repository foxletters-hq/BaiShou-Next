import { describe, expect, it } from 'vitest'
import {
  clampMobilePdfRenderDpi,
  createMobilePdfPageBitmapRenderer,
  normalizePdfFilePath,
  type NativePdfPageRender
} from '../mobile-pdf-page-render.util'

describe('mobile pdf page render util', () => {
  it('should strip the file URI prefix when native APIs want a filesystem path', () => {
    expect(normalizePdfFilePath('file:///data/page.pdf')).toBe('/data/page.pdf')
    expect(normalizePdfFilePath('/data/page.pdf')).toBe('/data/page.pdf')
  })

  it('should clamp DPI to the phone-safe range', () => {
    expect(clampMobilePdfRenderDpi(undefined)).toBe(200)
    expect(clampMobilePdfRenderDpi(72)).toBe(72)
    expect(clampMobilePdfRenderDpi(48)).toBe(72)
    expect(clampMobilePdfRenderDpi(250)).toBe(200)
  })

  it('should throw a rebuild hint when the native renderer is missing', async () => {
    const render = createMobilePdfPageBitmapRenderer(null)
    await expect(render({ absolutePath: '/tmp/scan.pdf', pageNumbers: [1] })).rejects.toThrow(
      /pnpm dev:mobile:clear/
    )
  })

  it('should serialize overlapping page renders when the native renderer is not thread-safe', async () => {
    const order: string[] = []
    const native: NativePdfPageRender = {
      isAvailable: () => true,
      getPageCount: async () => 2,
      renderPages: async (_filePath, pageNumbers) => {
        const page = pageNumbers[0] ?? 0
        order.push(`start-${page}`)
        await new Promise((resolve) => setTimeout(resolve, 20))
        order.push(`end-${page}`)
        return [{ page, pngBase64: 'x', width: 8, height: 8 }]
      }
    }
    const render = createMobilePdfPageBitmapRenderer(native)
    await Promise.all([
      render({ absolutePath: 'file:///tmp/scan.pdf', pageNumbers: [1], dpi: 250 }),
      render({ absolutePath: 'file:///tmp/scan.pdf', pageNumbers: [2], dpi: 250 })
    ])
    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2'])
  })

  it('should pass a filesystem path and clamped DPI to the native renderer', async () => {
    const calls: Array<{ path: string; pages: number[]; dpi: number }> = []
    const native: NativePdfPageRender = {
      isAvailable: () => true,
      getPageCount: async () => 1,
      renderPages: async (filePath, pageNumbers, dpi) => {
        calls.push({ path: filePath, pages: pageNumbers, dpi })
        return [{ page: 1, pngBase64: 'abc', width: 10, height: 12 }]
      }
    }
    const render = createMobilePdfPageBitmapRenderer(native)
    const pages = await render({
      absolutePath: 'file:///vault/doc.pdf',
      pageNumbers: [1],
      dpi: 300
    })
    expect(calls).toEqual([{ path: '/vault/doc.pdf', pages: [1], dpi: 200 }])
    expect(pages).toEqual([{ page: 1, pngBase64: 'abc', width: 10, height: 12 }])
  })

  it('should read native availability on each render call', async () => {
    let available = false
    const native: NativePdfPageRender = {
      isAvailable: () => available,
      getPageCount: async () => 1,
      renderPages: async () => [{ page: 1, pngBase64: 'x', width: 1, height: 1 }]
    }
    const render = createMobilePdfPageBitmapRenderer(() => native)
    await expect(render({ absolutePath: '/a.pdf', pageNumbers: [1] })).rejects.toThrow(
      /pnpm dev:mobile:clear/
    )
    available = true
    await expect(render({ absolutePath: '/a.pdf', pageNumbers: [1] })).resolves.toEqual([
      { page: 1, pngBase64: 'x', width: 1, height: 1 }
    ])
  })
})
