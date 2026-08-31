import { describe, expect, it } from 'vitest'
import {
  localFileContentType,
  localProtocolEmojiRelativePath,
  localProtocolFileResponseHeaders,
  localProtocolUrlToFilePath,
  parseByteRangeHeader,
  toLocalProtocolFileUrl
} from '../local-protocol.util'

describe('local-protocol.util', () => {
  it('reconstructs Windows drive paths when Chromium uses the letter as host', () => {
    const expected = 'D:/Vault/Notebooks/nb1/cover.png'
    expect(
      localProtocolUrlToFilePath('local://D:/Vault/Notebooks/nb1/cover.png').replace(/\\/g, '/')
    ).toBe(expected)
    expect(
      localProtocolUrlToFilePath('local://D/Vault/Notebooks/nb1/cover.png').replace(/\\/g, '/')
    ).toBe(expected)
  })

  it('round-trips an absolute path through local://', () => {
    const abs =
      process.platform === 'win32'
        ? 'D:\\Vault\\Notebooks\\nb1\\cover.png'
        : '/Vault/Notebooks/nb1/cover.png'
    const url = toLocalProtocolFileUrl(abs)
    expect(url.startsWith('local:')).toBe(true)
    expect(localProtocolUrlToFilePath(`${url}?t=99`).replace(/\\/g, '/')).toBe(
      abs.replace(/\\/g, '/')
    )
  })

  it('only treats host-less emojis/ paths as vault-relative emoji keys', () => {
    expect(localProtocolEmojiRelativePath('local:///emojis/cat.png')).toBe('cat.png')
    expect(localProtocolEmojiRelativePath('local://D:/emojis/cat.png')).toBeNull()
    expect(localProtocolEmojiRelativePath('local:///emojis/../secret.png')).toBeNull()
  })

  it('maps common image extensions to content types', () => {
    expect(localFileContentType('cover.PNG')).toBe('image/png')
    expect(localFileContentType('cover.webp')).toBe('image/webp')
    expect(localFileContentType('notes.md')).toBe('text/plain; charset=utf-8')
    expect(localFileContentType('doc.pdf')).toBe('application/pdf')
  })

  it('parses HTTP byte ranges for incremental PDF reads', () => {
    expect(parseByteRangeHeader(null, 1000)).toBeNull()
    expect(parseByteRangeHeader('bytes=0-65535', 1_000_000)).toEqual({ start: 0, end: 65535 })
    expect(parseByteRangeHeader('bytes=900-', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseByteRangeHeader('bytes=-200', 1000)).toEqual({ start: 800, end: 999 })
    expect(parseByteRangeHeader('bytes=0-50', 20)).toEqual({ start: 0, end: 19 })
    expect(parseByteRangeHeader('bytes=2000-2010', 1000)).toBe('unsatisfiable')
    expect(localProtocolFileResponseHeaders({ contentType: 'application/pdf', size: 80 }).status).toBe(
      200
    )
    expect(
      localProtocolFileResponseHeaders({
        contentType: 'application/pdf',
        size: 80,
        range: { start: 10, end: 19 }
      })
    ).toEqual({
      status: 206,
      headers: {
        'Content-Type': 'application/pdf',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'Content-Length': '10',
        'Content-Range': 'bytes 10-19/80'
      }
    })
  })
})
