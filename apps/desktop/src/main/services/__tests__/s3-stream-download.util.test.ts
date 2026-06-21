import { describe, expect, it } from 'vitest'
import { isRetryableS3DownloadError } from '../s3-stream-download.util'

describe('isRetryableS3DownloadError', () => {
  it('returns true for stream pipe failures', () => {
    const error = new Error('Cannot pipe to a closed or destroyed stream')
    ;(error as NodeJS.ErrnoException).code = 'ERR_STREAM_UNABLE_TO_PIPE'
    expect(isRetryableS3DownloadError(error)).toBe(true)
  })

  it('returns false for missing object errors', () => {
    const error = new Error('Not Found')
    ;(error as NodeJS.ErrnoException).code = 'NotFound'
    expect(isRetryableS3DownloadError(error)).toBe(false)
  })
})
