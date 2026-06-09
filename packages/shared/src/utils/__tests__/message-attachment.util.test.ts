import { describe, it, expect } from 'vitest'
import {
  mapAttachmentsFromParts,
  normalizePartData,
  resolveAttachmentAbsolutePath,
  resolveAttachmentImageSrc
} from '../message-attachment.util'

describe('normalizePartData', () => {
  it('parses JSON string part data', () => {
    const data = normalizePartData(
      JSON.stringify({ fileName: 'notes.md', isText: true, textContent: '# Hello' })
    )
    expect(data.fileName).toBe('notes.md')
    expect(data.isText).toBe(true)
  })
})

describe('resolveAttachmentImageSrc', () => {
  it('converts windows path to local protocol url', () => {
    expect(resolveAttachmentImageSrc('D:\\vault\\photo.png')).toBe('local:///D:/vault/photo.png')
  })

  it('keeps local protocol url unchanged', () => {
    expect(resolveAttachmentImageSrc('local:///D:/vault/photo.png')).toBe(
      'local:///D:/vault/photo.png'
    )
  })
})

describe('resolveAttachmentAbsolutePath', () => {
  it('decodes local protocol url to filesystem path', () => {
    expect(resolveAttachmentAbsolutePath('local:///D:/vault/photo.png')).toBe('D:/vault/photo.png')
  })
})

describe('mapAttachmentsFromParts', () => {

  it('maps md attachment parts for chat bubble', () => {
    const result = mapAttachmentsFromParts([
      { id: 'part-1', type: 'text', data: { text: '请总结这个文件' } },
      {
        id: 'part-2',
        type: 'attachment',
        data: {
          fileName: 'readme.md',
          filePath: 'D:\\vault\\attachments\\s1\\readme_123.md',
          isText: true,
          textContent: '# Title'
        }
      }
    ])

    expect(result).toHaveLength(1)
    expect(result?.[0]).toMatchObject({
      id: 'part-2',
      fileName: 'readme.md',
      isText: true,
      isImage: false
    })
    expect(result?.[0]?.filePath).toMatch(/^local:\/\//)
  })

  it('maps image parts separately from file attachments', () => {
    const result = mapAttachmentsFromParts([
      { id: 'img-1', type: 'image', data: { fileName: 'shot.png', isImage: true, filePath: 'D:\\a.png' } },
      { id: 'file-1', type: 'attachment', data: { fileName: 'doc.pdf', isPdf: true, filePath: 'D:\\b.pdf' } }
    ])

    expect(result).toHaveLength(2)
    expect(result?.[0]?.isImage).toBe(true)
    expect(result?.[1]?.isPdf).toBe(true)
  })

  it('parses stringified attachment data', () => {
    const result = mapAttachmentsFromParts([
      {
        id: 'part-3',
        type: 'attachment',
        data: JSON.stringify({ fileName: 'doc.md', isText: true })
      }
    ])

    expect(result?.[0]?.fileName).toBe('doc.md')
    expect(result?.[0]?.isText).toBe(true)
  })
})
