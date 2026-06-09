import { describe, it, expect, vi } from 'vitest'
import {
  appendImagePartToContentParts,
  inferAttachmentFlags,
  finalizeUserContentParts
} from '../agent/attachment-content.builder'

vi.mock('../platform/read-local-file', () => ({
  canReadLocalPath: (p: string) => Boolean(p),
  readLocalFileAsBase64: () => 'ZmFrZQ==',
  readPdfTextFromPath: async () => 'pdf text'
}))

vi.mock('../platform/normalize-image-for-model', () => ({
  normalizeImageForModel: async () => ({
    base64: 'ZmFrZQ==',
    mimeType: 'image/png'
  })
}))

describe('inferAttachmentFlags', () => {
  it('detects image by file extension when flags missing', () => {
    expect(inferAttachmentFlags({ fileName: 'photo.png' }).isImage).toBe(true)
  })
})

describe('appendImagePartToContentParts', () => {
  it('uses text placeholder for non-vision models', async () => {
    const parts: unknown[] = []
    await appendImagePartToContentParts(
      parts,
      { fileName: 'photo.png', filePath: 'D:\\a.png' },
      { modelId: 'deepseek-v4-flash' }
    )

    expect(parts).toHaveLength(1)
    expect((parts[0] as { type: string }).type).toBe('text')
    expect((parts[0] as { text: string }).text).toContain('不支持识图')
  })

  it('encodes image for vision models after normalization', async () => {
    const parts: unknown[] = []
    await appendImagePartToContentParts(
      parts,
      { fileName: 'photo.png', filePath: 'D:\\vault\\attachments\\s1\\photo.png' },
      { modelId: 'gemini-3-flash-preview' }
    )

    expect(parts).toHaveLength(1)
    expect(parts[0]).toEqual({
      type: 'image',
      image: 'ZmFrZQ==',
      mediaType: 'image/png'
    })
  })
})

describe('finalizeUserContentParts', () => {
  it('keeps multipart content when image is present', () => {
    const result = finalizeUserContentParts([
      { type: 'text', text: 'look' },
      { type: 'image', image: 'abc', mediaType: 'image/png' }
    ])
    expect(Array.isArray(result)).toBe(true)
  })
})
