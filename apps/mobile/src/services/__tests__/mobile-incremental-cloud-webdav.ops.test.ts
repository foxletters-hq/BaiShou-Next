import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IncrementalCloudOpsHost } from '../mobile-incremental-cloud-ops.types'

vi.mock('i18next', () => {
  const i18n = {
    t: (_key: string, fallback?: string) => fallback ?? _key,
    use() {
      return this
    },
    init() {
      return this
    }
  }
  return { default: i18n }
})

vi.mock('expo-baishou-server', () => ({
  getLegacyFlutterStorageRoots: () => [],
  isExternalStorageNativeAvailable: () => false,
  isLocalFsNativeAvailable: () => false,
  externalCopy: () => {},
  externalCopyAsync: async () => {},
  externalCopyFileAsync: async () => {},
  externalDelete: () => {},
  externalGetInfo: () => ({ exists: false, isDirectory: false, modificationTime: 0, size: 0 }),
  externalMakeDirectory: () => {},
  externalMove: () => {},
  externalReadBase64: () => '',
  externalReadDirectory: () => [],
  externalReadString: () => '',
  externalWriteBase64: () => {},
  externalWriteString: () => {},
  externalAppendString: () => {},
  localAppendString: () => {},
  localGetInfo: () => ({ exists: false, isDirectory: false, modificationTime: 0, size: 0 }),
  localReadDirectory: () => [],
  localMd5Hex: () => '',
  externalMd5Hex: () => ''
}))

vi.mock('../mobile-app-paths', () => ({
  getAppCacheDirectory: () => 'file:///tmp/cache/',
  getAppDocumentDirectory: () => 'file:///tmp/docs/'
}))

vi.mock('../android-external-fs', () => ({
  toFileUri: (p: string) => p
}))

vi.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
  deleteAsync: vi.fn()
}))

vi.mock('../mobile-http-transfer', () => ({
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  uploadAsync: vi.fn().mockResolvedValue({ status: 201 }),
  downloadAsync: vi.fn().mockResolvedValue({ status: 200 })
}))

vi.mock('../mobile-sync-file-read.util', () => ({
  canHttpUploadSyncFileFromPath: () => false,
  httpUploadSyncFile: vi.fn(),
  readSyncFileChunk: vi.fn().mockResolvedValue(new ArrayBuffer(4))
}))

import { downloadWebDav, listWebDav, uploadWebDav } from '../mobile-incremental-cloud-webdav.ops'
import { downloadAsync } from '../mobile-http-transfer'

function createHost(overrides: Partial<IncrementalCloudOpsHost> = {}): IncrementalCloudOpsHost {
  return {
    config: {
      enabled: true,
      target: 'webdav',
      endpoint: '',
      region: '',
      bucket: '',
      path: 'memories_sync/',
      accessKey: '',
      secretKey: '',
      webdavUrl: 'https://dav.example.com/',
      webdavUsername: 'user',
      webdavPassword: 'pass'
    },
    fileSystem: {
      stat: vi.fn().mockResolvedValue({ size: 4 })
    } as unknown as IncrementalCloudOpsHost['fileSystem'],
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
    webdavConfiguredBaseUrl: () => 'https://dav.example.com',
    adoptWebDavBaseUrl: () => {},
    webdavFileUrl: (rel) => `https://dav.example.com/memories_sync/${rel}`,
    needsHttpStaging: () => false,
    httpStagingPath: (p) => p,
    ...overrides
  }
}

function propfindXml(href: string, size = 12): string {
  return `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>${href}</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype/>
        <d:getcontentlength>${size}</d:getcontentlength>
        <d:getlastmodified>Wed, 01 Jan 2020 00:00:00 GMT</d:getlastmodified>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`
}

describe('mobile-incremental-cloud-webdav.ops', { timeout: 15_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should list managed zip records when PROPFIND returns a file', async () => {
    const host = createHost({
      fetchWithAbort: vi.fn().mockResolvedValue({
        ok: true,
        status: 207,
        statusText: 'Multi-Status',
        text: async () => propfindXml('/memories_sync/Personal/backup.zip', 88)
      })
    })

    const records = await listWebDav(host)
    expect(records).toHaveLength(1)
    expect(records[0]?.filename).toContain('backup.zip')
    expect(records[0]?.sizeInBytes).toBe(88)
  })

  it('should create parent directories when uploading a nested file', async () => {
    const fetchWithAbort = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'MKCOL') {
        return { ok: true, status: 201 }
      }
      if (init?.method === 'PROPFIND') {
        return {
          ok: true,
          status: 207,
          text: async () => '<d:getcontentlength>4</d:getcontentlength>'
        }
      }
      return { ok: true, status: 201 }
    })
    const host = createHost({
      fetchWithAbort: fetchWithAbort as unknown as IncrementalCloudOpsHost['fetchWithAbort']
    })

    await uploadWebDav(host, 'Personal/a.zip', '/tmp/a.zip')

    const mkcolCalls = fetchWithAbort.mock.calls.filter((call) => call[1]?.method === 'MKCOL')
    expect(mkcolCalls.length).toBeGreaterThan(0)
    expect(mkcolCalls.some((call) => String(call[0]).includes('memories_sync'))).toBe(true)
  })

  it('should download with a single request when remote size is small', async () => {
    const fetchWithAbort = vi.fn().mockResolvedValue({
      ok: true,
      status: 207,
      text: async () => '<d:getcontentlength>8</d:getcontentlength>'
    })
    const host = createHost({ fetchWithAbort })

    await downloadWebDav(host, 'a.zip', '/tmp/a.zip', '/tmp/a.zip')

    expect(downloadAsync).toHaveBeenCalledTimes(1)
    expect(fetchWithAbort).toHaveBeenCalledWith(
      'https://dav.example.com/memories_sync/a.zip',
      expect.objectContaining({ method: 'PROPFIND' })
    )
  })
})
