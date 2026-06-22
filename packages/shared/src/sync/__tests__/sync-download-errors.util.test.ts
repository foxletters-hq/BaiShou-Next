import { describe, expect, it } from 'vitest'
import { isIncrementalSyncRemoteFileNotFoundError } from '../sync-download-errors.util'

describe('isIncrementalSyncRemoteFileNotFoundError', () => {
  it('识别 S3 NotFound code', () => {
    expect(isIncrementalSyncRemoteFileNotFoundError({ code: 'NotFound', message: 'x' })).toBe(true)
  })

  it('识别 HTTP 404', () => {
    expect(isIncrementalSyncRemoteFileNotFoundError({ statusCode: 404 })).toBe(true)
  })

  it('识别消息中的 404 / Not Found', () => {
    expect(isIncrementalSyncRemoteFileNotFoundError(new Error('GET 404 Not Found'))).toBe(true)
    expect(isIncrementalSyncRemoteFileNotFoundError('resource not found')).toBe(true)
  })

  it('非 404 错误返回 false', () => {
    expect(isIncrementalSyncRemoteFileNotFoundError(new Error('timeout'))).toBe(false)
    expect(isIncrementalSyncRemoteFileNotFoundError({ statusCode: 500 })).toBe(false)
  })
})
