import { describe, expect, it, vi } from 'vitest'
import { s3FetchHeaders } from '../aws-v4-sign'

describe('signS3Request', () => {
  it('signs S3 list requests without throwing on Host header casing', async () => {
    const { signS3Request } = await import('../aws-v4-sign')
    const headers = await signS3Request(
      'GET',
      'https://my-bucket.s3.amazonaws.com/?list-type=2&max-keys=1&prefix=backup_sync',
      'us-east-1',
      'test-access-key',
      'test-secret-key',
      null
    )

    expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=/)
    expect(headers['x-amz-date']).toBeTruthy()
    expect(headers.Host ?? headers.host).toBeTruthy()
  })

  it('signs S3 list requests using pure JS when Web Crypto is unavailable', async () => {
    const originalCrypto = globalThis.crypto
    vi.stubGlobal('crypto', undefined)
    vi.resetModules()

    try {
      const { signS3Request } = await import('../aws-v4-sign')
      const headers = await signS3Request(
        'GET',
        'https://my-bucket.s3.amazonaws.com/?list-type=2&max-keys=1&prefix=backup_sync',
        'us-east-1',
        'test-access-key',
        'test-secret-key',
        null
      )

      expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=/)
      expect(headers['x-amz-date']).toBeTruthy()
    } finally {
      vi.stubGlobal('crypto', originalCrypto)
      vi.resetModules()
    }
  })

  it('produces identical signatures with pure JS and Web Crypto for encoded prefix', async () => {
    const url =
      'https://my-bucket.s3.amazonaws.com/?list-type=2&max-keys=1&prefix=backup_sync%2F'
    const fixedDate = new Date('2020-01-01T00:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(fixedDate)

    const { signS3Request: signWeb } = await import('../aws-v4-sign')
    const web = await signWeb(
      'GET',
      url,
      'us-east-1',
      'test-access-key',
      'test-secret-key',
      null
    )

    const originalCrypto = globalThis.crypto
    vi.stubGlobal('crypto', undefined)
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(fixedDate)

    try {
      const { signS3Request: signPure } = await import('../aws-v4-sign')
      const pure = await signPure(
        'GET',
        url,
        'us-east-1',
        'test-access-key',
        'test-secret-key',
        null
      )
      expect(pure.Authorization).toBe(web.Authorization)
    } finally {
      vi.useRealTimers()
      vi.stubGlobal('crypto', originalCrypto)
      vi.resetModules()
    }
  })

  it('strips Host from fetch headers while keeping signature headers', async () => {
    const { signS3Request } = await import('../aws-v4-sign')
    const signed = await signS3Request(
      'GET',
      'https://my-bucket.s3.amazonaws.com/?list-type=2&prefix=backup_sync%2F',
      'us-east-1',
      'test-access-key',
      'test-secret-key',
      null
    )
    const fetchHeaders = s3FetchHeaders(signed)
    expect(signed.Host).toBeTruthy()
    expect(fetchHeaders.Host).toBeUndefined()
    expect(fetchHeaders.host).toBeUndefined()
    expect(fetchHeaders.Authorization).toMatch(/^AWS4-HMAC-SHA256/)
  })
})
