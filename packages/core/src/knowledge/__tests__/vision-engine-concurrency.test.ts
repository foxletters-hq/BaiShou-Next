import { afterEach, describe, expect, it } from 'vitest'
import {
  registerPdfPageBitmapRenderer,
  registerVisionPageRecognizer,
  visionExtractEngine
} from '../extract-engines'

afterEach(() => {
  registerPdfPageBitmapRenderer(null)
  registerVisionPageRecognizer(null)
})

describe('vision extract concurrency', () => {
  it('should render a concurrency-sized batch then recognize those pages in parallel', async () => {
    const renderCalls: number[][] = []
    let inflight = 0
    let maxInflight = 0
    registerPdfPageBitmapRenderer(async ({ pageNumbers }) => {
      renderCalls.push([...(pageNumbers ?? [])])
      return (pageNumbers ?? []).map((page) => ({
        page,
        pngBase64: `p${page}`,
        width: 8,
        height: 8
      }))
    })
    registerVisionPageRecognizer(async ({ page }) => {
      inflight += 1
      maxInflight = Math.max(maxInflight, inflight)
      await new Promise((resolve) => setTimeout(resolve, 20))
      inflight -= 1
      return `视觉正文 ${page}`
    })

    const result = await visionExtractEngine.extract({
      absolutePath: `/tmp/scan-conc-${Date.now()}.pdf`,
      existingPageTexts: ['', '', '', '', ''],
      concurrency: 3
    })

    expect(renderCalls).toEqual([
      [1, 2, 3],
      [4, 5]
    ])
    expect(maxInflight).toBe(3)
    expect(result.processedPages).toEqual([1, 2, 3, 4, 5])
  })
})
