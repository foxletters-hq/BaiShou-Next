import { describe, expect, it } from 'vitest'
import { isIncrementalSyncReady } from '../incremental-sync-config.util'
import type { S3SyncConfig } from '../../types/version-control.types'

describe('isIncrementalSyncReady', () => {
  const base: S3SyncConfig = {
    enabled: true,
    endpoint: 'https://s3.example.com',
    region: 'us-east-1',
    bucket: 'bucket',
    path: 'memories_sync',
    accessKey: 'ak',
    secretKey: 'sk',
    target: 's3'
  }

  it('returns false when disabled', () => {
    expect(isIncrementalSyncReady({ ...base, enabled: false })).toBe(false)
  })

  it('returns true for complete s3 config', () => {
    expect(isIncrementalSyncReady(base)).toBe(true)
  })

  it('returns true for complete webdav config', () => {
    expect(
      isIncrementalSyncReady({
        ...base,
        target: 'webdav',
        webdavUrl: 'https://dav.example.com',
        secretKey: ''
      })
    ).toBe(true)
  })
})
