import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearImageCompressor } from '../image-compressor.registry'
import { buildVisionPageImagePart } from '../vision-page-image-part'

const PNG_BASE64 = 'ZmFrZVBuZw=='

afterEach(() => {
  clearImageCompressor()
  vi.unstubAllGlobals()
})

describe('buildVisionPageImagePart', () => {
  it('should send bare base64 and mediaType instead of a data URL', async () => {
    const part = await buildVisionPageImagePart(PNG_BASE64)

    expect(part.type).toBe('image')
    expect(part.image).toBe(PNG_BASE64)
    expect(part.mediaType).toBe('image/png')
    expect(part.image.startsWith('data:')).toBe(false)
  })

  it('should strip a data URL prefix before sending the image', async () => {
    const part = await buildVisionPageImagePart(`data:image/png;base64,${PNG_BASE64}`)

    expect(part.image).toBe(PNG_BASE64)
    expect(part.mediaType).toBe('image/png')
  })

  it('should reject an empty page image', async () => {
    await expect(buildVisionPageImagePart('')).rejects.toThrow('视觉 OCR：页面图片为空')
    await expect(buildVisionPageImagePart('   ')).rejects.toThrow('视觉 OCR：页面图片为空')
  })
})
