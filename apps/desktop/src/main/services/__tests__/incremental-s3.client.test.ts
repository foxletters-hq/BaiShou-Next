import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IncrementalS3Client } from '../incremental-s3.client'

vi.mock('@baishou/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@baishou/shared')>()
  return {
    ...actual,
    listAllS3Objects: vi.fn()
  }
})

import { listAllS3Objects } from '@baishou/shared'

describe('IncrementalS3Client.listFiles', () => {
  beforeEach(() => {
    vi.mocked(listAllS3Objects).mockReset()
  })

  it('uses listAllS3Objects instead of Minio listObjectsV2 stream', async () => {
    vi.mocked(listAllS3Objects).mockResolvedValue([
      {
        key: 'memories_sync/Personal/Journals/a.md',
        lastModified: '2026-01-01T00:00:00.000Z',
        size: 12
      }
    ])

    const client = new IncrementalS3Client(
      'https://s3.example.com',
      'us-east-1',
      'bucket',
      'ak',
      'sk',
      'memories_sync'
    )

    const records = await client.listFiles()

    expect(listAllS3Objects).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'https://s3.example.com',
        bucket: 'bucket',
        prefix: 'memories_sync/',
        accessKey: 'ak',
        secretKey: 'sk'
      })
    )
    expect(records).toEqual([
      expect.objectContaining({
        filename: 'Personal/Journals/a.md',
        sizeInBytes: 12
      })
    ])
  })
})
