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
    registerPdfPageBitmapRenderer(async () => [
      { page: 1, pngBase64: 'x', width: 8, height: 8 }
    ])
    registerVisionPageRecognizer(async () => '试抽正文')

    await visionExtractEngine.extract({
      absolutePath,
      pageNumbers: [1],
      existingPageTexts: ['', '', ''],
      persistCache: false
    })

    expect(getRegisteredSimplePageTexts(absolutePath)).toBeNull()
  })
})
