import { describe, expect, it } from 'vitest'
import {
  collectSessionAttachmentFileNames,
  resolveSessionAttachmentFileName,
  sanitizeSessionAttachmentFileName
} from '../session-attachment-file.util'

describe('sanitizeSessionAttachmentFileName', () => {
  it('rejects encoded path traversal', () => {
    expect(sanitizeSessionAttachmentFileName('%2e%2e')).toBeNull()
    expect(sanitizeSessionAttachmentFileName('%2e%2e%2fpasswd')).toBeNull()
    expect(sanitizeSessionAttachmentFileName('..')).toBeNull()
    expect(sanitizeSessionAttachmentFileName('a/b')).toBeNull()
  })

  it('accepts normal and percent-encoded file names', () => {
    expect(sanitizeSessionAttachmentFileName('photo_1.jpg')).toBe('photo_1.jpg')
    expect(sanitizeSessionAttachmentFileName('photo%201.jpg')).toBe('photo 1.jpg')
  })
})

describe('resolveSessionAttachmentFileName', () => {
  const sessionId = 'bab73557-b005-40a4-9021-2bb9a427e4c6'

  it('extracts file name from desktop absolute path', () => {
    expect(
      resolveSessionAttachmentFileName(
        sessionId,
        `D:/Vaults/Personal/Attachments/${sessionId}/photo_123.jpeg`
      )
    ).toBe('photo_123.jpeg')
  })

  it('extracts file name from android absolute path', () => {
    expect(
      resolveSessionAttachmentFileName(
        sessionId,
        `/storage/emulated/0/Baishou-Love/Personal/Attachments/${sessionId}/a.png`
      )
    ).toBe('a.png')
  })

  it('extracts from file:// and local:/// urls', () => {
    expect(
      resolveSessionAttachmentFileName(
        sessionId,
        `file:///D:/Vaults/Personal/Attachments/${sessionId}/doc.pdf`
      )
    ).toBe('doc.pdf')
    expect(
      resolveSessionAttachmentFileName(
        sessionId,
        `local:///D:/Vaults/Personal/Attachments/${sessionId}/x.png`
      )
    ).toBe('x.png')
  })

  it('skips emoji and avatar paths', () => {
    expect(resolveSessionAttachmentFileName(sessionId, 'emojis/cat.png')).toBeNull()
    expect(
      resolveSessionAttachmentFileName(sessionId, `D:/Vaults/Personal/Attachments/emojis/cat.png`)
    ).toBeNull()
  })

  it('skips ephemeral urls', () => {
    expect(resolveSessionAttachmentFileName(sessionId, 'data:image/png;base64,xxx')).toBeNull()
    expect(resolveSessionAttachmentFileName(sessionId, 'https://example.com/a.png')).toBeNull()
  })

  it('rejects encoded traversal inside session path', () => {
    expect(
      resolveSessionAttachmentFileName(
        sessionId,
        `D:/Vaults/Personal/Attachments/${sessionId}/%2e%2e/%2e%2e/secret.txt`
      )
    ).toBeNull()
  })
})

describe('collectSessionAttachmentFileNames', () => {
  const sessionId = 'sess-1'

  it('collects unique file names from image/attachment parts', () => {
    const names = collectSessionAttachmentFileNames(sessionId, [
      {
        type: 'image',
        data: { filePath: `D:/x/Attachments/${sessionId}/a.png` }
      },
      {
        type: 'attachment',
        data: { filePath: `D:/x/Attachments/${sessionId}/a.png` }
      },
      {
        type: 'image',
        data: { filePath: `D:/x/Attachments/${sessionId}/b.pdf` }
      },
      {
        type: 'text',
        data: { text: 'hi' }
      },
      {
        type: 'image',
        data: { filePath: 'emojis/skip.png' }
      }
    ])
    expect(names.sort()).toEqual(['a.png', 'b.pdf'])
  })
})
