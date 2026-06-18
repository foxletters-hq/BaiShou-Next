import { describe, expect, it } from 'vitest'
import {
  getIncrementalSyncStorageId,
  resolveIncrementalSyncStorageHistory
} from '../../utils/incremental-sync-storage.util'

describe('incremental-sync-storage.util', () => {
  const config = {
    enabled: true,
    endpoint: 'https://s3.example.com',
    region: 'us-east-1',
    bucket: 'MyBucket',
    path: 'backup_sync/',
    accessKey: 'key',
    secretKey: 'secret',
    target: 's3' as const
  }

  it('resolves storage history states', () => {
    const id = getIncrementalSyncStorageId(config)
    expect(resolveIncrementalSyncStorageHistory(null, config)).toBe('none')
    expect(resolveIncrementalSyncStorageHistory('', config)).toBe('none')
    expect(resolveIncrementalSyncStorageHistory(id, config)).toBe('match')
    expect(resolveIncrementalSyncStorageHistory('other', config)).toBe('mismatch')
  })
})
