import { afterEach, describe, expect, it } from 'vitest'
import {
  getRegisteredSimplePageTexts,
  registerPdfPageBitmapRenderer,
  registerVisionPageRecognizer,
  visionExtractEngine
} from '../extract-engines'

describe('vision extract persistCache', () => {
  afterEach(() => {
    registerPdfPageBitmapRenderer(null)
    registerVisionPageRecognizer(null)
  })

  it('should skip the in-process page cache when persistCache is false', async () => {
    const absolutePath = `/tmp/probe-${Date.now()}.pdf`
    registerPdfPageBitmapRenderer(async () => [{ page: 1, pngBase64: 'x', width: 8, height: 8 }])
    registerVisionPageRecognizer(async () => '试抽正文')

    await visionExtractEngine.extract({
      absolutePath,
      pageNumbers: [1],
      existingPageTexts: ['', '', ''],
      persistCache: false
    })

    expect(getRegisteredSimplePageTexts(absolutePath)).toBeNull()
  })

  it('should send every PDF page to vision even when the text layer looks full', async () => {
    const absolutePath = `/tmp/scan-${Date.now()}.pdf`
    const filled = '这段文字层看起来很长，足够骗过旧的缺页判断。'.repeat(8)
    const recognized: number[] = []
    registerPdfPageBitmapRenderer(async ({ pageNumbers }) =>
      (pageNumbers ?? []).map((page) => ({ page, pngBase64: 'x', width: 8, height: 8 }))
    )
    registerVisionPageRecognizer(async ({ page }) => {
      recognized.push(page)
      return `视觉正文 ${page}`
    })

    const result = await visionExtractEngine.extract({
      absolutePath,
      existingPageTexts: [filled, filled, filled]
    })

    expect(recognized.sort((a, b) => a - b)).toEqual([1, 2, 3])
    expect(result.processedPages).toEqual([1, 2, 3])
    expect(result.text).toContain('视觉正文 1')
  })
})
