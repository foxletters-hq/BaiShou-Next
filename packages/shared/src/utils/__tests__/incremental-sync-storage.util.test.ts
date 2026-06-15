import { describe, expect, it } from 'vitest'
import { getIncrementalSyncStorageId } from '../incremental-sync-storage.util'

describe('incremental-sync-storage.util', () => {
  it('separates s3 and webdav identities', () => {
    const s3Id = getIncrementalSyncStorageId({
      enabled: true,
      target: 's3',
      endpoint: 'https://s3.example.com',
      region: 'us-east-1',
      bucket: 'my-bucket',
      path: 'memories_sync',
      accessKey: 'ak',
      secretKey: 'sk'
    })
    const webdavId = getIncrementalSyncStorageId({
      enabled: true,
      target: 'webdav',
      endpoint: '',
      region: '',
      bucket: '',
      path: 'memories_sync',
      accessKey: 'user',
      secretKey: 'pass',
      webdavUrl: 'https://dav.example.com/dav'
    })
    expect(s3Id).toContain('s3:')
    expect(webdavId).toContain('webdav:')
    expect(s3Id).not.toBe(webdavId)
  })

  it('changes when bucket or webdav url changes', () => {
    const a = getIncrementalSyncStorageId({
      enabled: true,
      target: 's3',
      endpoint: 'https://s3.example.com',
      region: '',
      bucket: 'a',
      path: 'memories_sync',
      accessKey: '',
      secretKey: ''
    })
    const b = getIncrementalSyncStorageId({
      enabled: true,
      target: 's3',
      endpoint: 'https://s3.example.com',
      region: '',
      bucket: 'b',
      path: 'memories_sync',
      accessKey: '',
      secretKey: ''
    })
    expect(a).not.toBe(b)
  })
})
