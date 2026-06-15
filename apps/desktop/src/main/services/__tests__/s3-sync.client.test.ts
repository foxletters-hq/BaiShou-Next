import { describe, it, expect, vi, beforeEach } from 'vitest'
import { S3SyncClient } from '../s3-sync.client'

vi.mock('@baishou/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@baishou/shared')>()
  return {
    ...actual,
    listAllS3Objects: vi.fn()
  }
})

import { listAllS3Objects } from '@baishou/shared'

describe('S3SyncClient.listFiles', () => {
  beforeEach(() => {
    vi.mocked(listAllS3Objects).mockReset()
  })

  it('uses listAllS3Objects and filters zip backups only', async () => {
    vi.mocked(listAllS3Objects).mockResolvedValue([
      {
        key: 'backup_sync/BaiShou_2026.zip',
        lastModified: '2026-01-01T00:00:00.000Z',
        size: 100
      },
      {
        key: 'backup_sync/readme.txt',
        lastModified: '2026-01-01T00:00:00.000Z',
        size: 1
      }
    ])

    const client = new S3SyncClient(
      'https://s3.example.com',
      'us-east-1',
      'bucket',
      'ak',
      'sk',
      'backup_sync'
    )

    const records = await client.listFiles()

    expect(listAllS3Objects).toHaveBeenCalled()
    expect(records).toHaveLength(1)
    expect(records[0]?.filename).toBe('BaiShou_2026.zip')
    expect(records[0]?.managed).toBe(true)
  })
})
