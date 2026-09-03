import { describe, it, expect, vi } from 'vitest'
import {
  appendFileAttachmentToContentParts,
  appendImagePartToContentParts,
  inferAttachmentFlags,
  finalizeUserContentParts
} from '../agent/attachment-content.builder'

vi.mock('../platform/read-local-file', () => ({
  canReadLocalPath: (p: string) => Boolean(p),
  readLocalFileAsBase64: () => 'ZmFrZQ==',
  readLocalFileAsBase64Async: async () => 'ZmFrZQ==',
  readLocalTextFile: async () => 'notes from disk',
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

  it('treats source files as text even when stored flags say otherwise', () => {
    expect(inferAttachmentFlags({ fileName: 'app.ts', isText: false, type: 'file' }).isText).toBe(
      true
    )
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

describe('appendFileAttachmentToContentParts', () => {
  it('reads text files from the original path when textContent is empty', async () => {
    const parts: unknown[] = []
    await appendFileAttachmentToContentParts(
      parts,
      { fileName: 'notes.md', filePath: 'D:\\Projects\\invoice\\notes.md', isText: true },
      { modelId: 'deepseek-v4-flash' }
    )

    expect((parts[0] as { text: string }).text).toContain('notes from disk')
    expect((parts[0] as { text: string }).text).toContain('notes.md')
  })

  it('inlines workspace source files with relative path and selection', async () => {
    const parts: unknown[] = []
    await appendFileAttachmentToContentParts(
      parts,
      {
        fileName: 'app.ts',
        relativePath: 'src/app.ts',
        filePath: 'D:\\Projects\\invoice\\src\\app.ts',
        selection: { startLine: 1, endLine: 1 },
        comment: '核对导出'
      },
      { modelId: 'deepseek-v4-flash' }
    )

    const text = (parts[0] as { text: string }).text
    expect(text).toContain('[User Uploaded File Attachment: src/app.ts (line 1)]')
    expect(text).toContain('notes from disk')
    expect(text).toContain('用户针对 src/app.ts 第 1 行的评论：核对导出')
  })

  it('rejects text that contains null bytes', async () => {
    const parts: unknown[] = []
    await appendFileAttachmentToContentParts(
      parts,
      {
        fileName: 'app.ts',
        relativePath: 'src/app.ts',
        isText: true,
        textContent: 'export const x = 1\0'
      },
      { modelId: 'deepseek-v4-flash' }
    )
    expect((parts[0] as { text: string }).text).toContain('无法直接放入对话')
  })

  it('writes a visible hint for unsupported binary files', async () => {
    const parts: unknown[] = []
    await appendFileAttachmentToContentParts(
      parts,
      { fileName: 'pack.zip', relativePath: 'pack.zip', filePath: 'D:\\Projects\\invoice\\pack.zip' },
      { modelId: 'deepseek-v4-flash' }
    )
    expect((parts[0] as { text: string }).text).toContain('pack.zip')
    expect((parts[0] as { text: string }).text).toContain('无法直接放入对话')
  })

  it('reads pdf text from the original path when native pdf is unsupported', async () => {
    const parts: unknown[] = []
    await appendFileAttachmentToContentParts(
      parts,
      { fileName: 'brief.pdf', filePath: 'D:\\Projects\\invoice\\brief.pdf', isPdf: true },
      { modelId: 'deepseek-v4-flash', providerType: 'deepseek' }
    )

    expect((parts[0] as { text: string }).text).toContain('pdf text')
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
