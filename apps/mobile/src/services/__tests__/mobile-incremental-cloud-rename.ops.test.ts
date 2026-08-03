import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IncrementalCloudOpsHost } from '../mobile-incremental-cloud-ops.types'
import { renameS3, renameWebDav } from '../mobile-incremental-cloud-rename.ops'

function createHost(overrides: Partial<IncrementalCloudOpsHost> = {}): IncrementalCloudOpsHost {
  return {
    config: {
      enabled: true,
      target: 's3',
      endpoint: 'https://s3.example.com',
      region: 'us-east-1',
      bucket: 'bucket',
      path: 'memories_sync/',
      accessKey: 'ak',
      secretKey: 'sk'
    },
    fileSystem: {} as IncrementalCloudOpsHost['fileSystem'],
    transferProgressDestPath: '',
    basePath: () => 'memories_sync/',
    relFromLocal: (p) => p,
    reportActivity: () => {},
    reportTransfer: () => {},
    fetchWithAbort: vi.fn(),
    transferWithAbort: async (run) => run(),
    signAndFetch: vi.fn(),
    readFileChunk: vi.fn(),
    s3ObjectKey: (rel) => `memories_sync/${rel}`,
    s3UrlOptions: (rel) => ({
      endpoint: 'https://s3.example.com',
      bucket: 'bucket',
      objectKey: `memories_sync/${rel}`
    }),
    isSyncManifestRel: () => false,
    webdavAuth: () => 'Basic dXNlcjpwYXNz',
    webdavConfiguredBaseUrl: () => 'https://dav.example.com/',
    adoptWebDavBaseUrl: () => {},
    webdavFileUrl: (rel) => `https://dav.example.com/memories_sync/${rel}`,
    needsHttpStaging: () => false,
    httpStagingPath: (p) => p,
    ...overrides
  }
}

describe('mobile-incremental-cloud-rename.ops', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renameS3 copies then deletes', async () => {
    const signAndFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 204 })
    const host = createHost({ signAndFetch })

    await renameS3(host, 'Personal/a.md', '工作/a.md')

    expect(signAndFetch).toHaveBeenCalledTimes(2)
    const copyCall = signAndFetch.mock.calls[0]!
    expect(copyCall[0]).toBe('PUT')
    expect(copyCall[2]).toEqual({
      'x-amz-copy-source': '/bucket/memories_sync/Personal/a.md'
    })
    expect(signAndFetch.mock.calls[1]![0]).toBe('DELETE')
  })

  it('renameS3 throws when copy fails', async () => {
    const host = createHost({
      signAndFetch: vi.fn().mockResolvedValue({ ok: false, status: 403 })
    })
    await expect(renameS3(host, 'a.md', 'b.md')).rejects.toThrow(/S3 copy failed/)
  })

  it('renameWebDav issues MOVE with Destination', async () => {
    const fetchWithAbort = vi
      .fn()
      // MKCOL for parent
      .mockResolvedValueOnce({ ok: true, status: 201 })
      // MOVE
      .mockResolvedValueOnce({ ok: true, status: 201 })
    const host = createHost({
      config: {
        enabled: true,
        target: 'webdav',
        endpoint: '',
        region: '',
        bucket: '',
        path: 'memories_sync/',
        accessKey: 'u',
        secretKey: 'p',
        webdavUrl: 'https://dav.example.com/'
      },
      fetchWithAbort
    })

    await renameWebDav(host, 'Personal/a.md', '工作/a.md')

    const moveCall = fetchWithAbort.mock.calls.find((c) => c[1]?.method === 'MOVE')
    expect(moveCall).toBeTruthy()
    expect(moveCall![1].headers.Destination).toContain('工作/a.md')
    expect(moveCall![1].headers.Overwrite).toBe('T')
  })

  it('renameWebDav throws when MOVE fails', async () => {
    const host = createHost({
      fetchWithAbort: vi.fn().mockResolvedValue({ ok: false, status: 500 })
    })
    await expect(renameWebDav(host, 'Old', 'New')).rejects.toThrow(/WebDAV MOVE failed/)
  })
})
