import { describe, expect, it } from 'vitest'
import {
  buildS3ListUrl,
  buildS3ObjectUrl,
  buildS3ObjectUrlWithQuery,
  encodeS3ObjectKeySegment,
  normalizeS3BasePath,
  shouldUseS3PathStyle
} from '../s3-url'

describe('s3-url', () => {
  it('normalizes base path with trailing slash', () => {
    expect(normalizeS3BasePath('backup_sync')).toBe('backup_sync/')
    expect(normalizeS3BasePath('/foo/bar')).toBe('foo/bar/')
  })

  it('uses path style for localhost and ipv4', () => {
    expect(shouldUseS3PathStyle('http://localhost:9000')).toBe(true)
    expect(shouldUseS3PathStyle('http://192.168.1.10:9000')).toBe(true)
    expect(shouldUseS3PathStyle('https://s3.amazonaws.com')).toBe(false)
  })

  it('builds virtual-hosted list url', () => {
    const url = buildS3ListUrl({
      endpoint: 'https://s3.us-east-1.amazonaws.com',
      bucket: 'my-bucket',
      prefix: 'backup_sync/'
    })
    expect(url).toBe(
      'https://my-bucket.s3.us-east-1.amazonaws.com/?list-type=2&prefix=backup_sync%2F'
    )
  })

  it('builds object url with multipart query', () => {
    const url = buildS3ObjectUrlWithQuery({
      endpoint: 'http://localhost:9000',
      bucket: 'b',
      objectKey: 'backup_sync/a.txt',
      query: { partNumber: '1', uploadId: 'abc' }
    })
    expect(url).toBe('http://localhost:9000/b/backup_sync/a.txt?partNumber=1&uploadId=abc')
  })

  it('encodes parentheses and spaces in object key segments for Sig V4', () => {
    const seg = '2026-02-27-表情包 (1)_1781399781572.png'
    expect(encodeS3ObjectKeySegment(seg)).toBe(
      '2026-02-27-%E8%A1%A8%E6%83%85%E5%8C%85%20%281%29_1781399781572.png'
    )
    const url = buildS3ObjectUrl({
      endpoint: 'https://s3.amazonaws.com',
      bucket: 'my-bucket',
      objectKey: `memories_sync/Personal/Attachments/uuid/${seg}`
    })
    expect(url).toContain(encodeS3ObjectKeySegment(seg))
    expect(url).not.toContain('(1)')
  })
})
