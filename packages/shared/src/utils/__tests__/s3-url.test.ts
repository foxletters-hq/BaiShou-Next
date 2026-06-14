import { describe, expect, it } from 'vitest'
import {
  buildS3ListUrl,
  buildS3ObjectUrlWithQuery,
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
})
