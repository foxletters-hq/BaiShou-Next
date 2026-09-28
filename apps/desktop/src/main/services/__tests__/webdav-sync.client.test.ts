import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()

vi.mock('webdav', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args)
}))

describe('WebDavSyncClient (ZIP cloud backup)', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    createClientMock.mockReturnValue({
      getDirectoryContents: vi.fn().mockResolvedValue([]),
      putFileContents: vi.fn(),
      createReadStream: vi.fn(),
      deleteFile: vi.fn(),
      moveFile: vi.fn(),
      createDirectory: vi.fn()
    })
  })

  it('normalizes missing scheme before createClient', async () => {
    const { WebDavSyncClient } = await import('../webdav-sync.client')
    new WebDavSyncClient('192.168.1.10:5005', 'u', 'p', '/baishou')
    expect(createClientMock).toHaveBeenCalledWith('http://192.168.1.10:5005', {
      username: 'u',
      password: 'p'
    })
  })

  it('retries listFiles over HTTP fallback when HTTPS network fails', async () => {
    const httpsClient = {
      getDirectoryContents: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
      putFileContents: vi.fn(),
      createReadStream: vi.fn(),
      deleteFile: vi.fn(),
      moveFile: vi.fn(),
      createDirectory: vi.fn()
    }
    const httpClient = {
      getDirectoryContents: vi.fn().mockResolvedValue([
        {
          type: 'file',
          basename: 'BaiShou_backup.zip',
          lastmod: '2026-01-01T00:00:00Z',
          size: 12
        }
      ]),
      putFileContents: vi.fn(),
      createReadStream: vi.fn(),
      deleteFile: vi.fn(),
      moveFile: vi.fn(),
      createDirectory: vi.fn()
    }

    createClientMock.mockReturnValueOnce(httpsClient).mockReturnValueOnce(httpClient)

    const { WebDavSyncClient } = await import('../webdav-sync.client')
    const client = new WebDavSyncClient('https://192.168.1.20:5006', 'u', 'p', '/baishou/')
    const records = await client.listFiles()

    expect(createClientMock).toHaveBeenNthCalledWith(1, 'https://192.168.1.20:5006', {
      username: 'u',
      password: 'p'
    })
    expect(createClientMock).toHaveBeenNthCalledWith(2, 'http://192.168.1.20:5005', {
      username: 'u',
      password: 'p'
    })
    expect(records).toHaveLength(1)
    expect(records[0]?.filename).toBe('BaiShou_backup.zip')
  })

  it('retries MKCOL on transient 503 before upload', async () => {
    const mockClient = {
      getDirectoryContents: vi.fn(),
      putFileContents: vi.fn().mockResolvedValue(undefined),
      createReadStream: vi.fn(),
      deleteFile: vi.fn(),
      moveFile: vi.fn(),
      createDirectory: vi
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error('busy'), { status: 503 }))
        .mockResolvedValueOnce(undefined)
    }
    createClientMock.mockReturnValue(mockClient)

    const { WebDavSyncClient } = await import('../webdav-sync.client')
    const client = new WebDavSyncClient('https://dav.example.com', 'u', 'p', '/backups/')

    // 避免真实读盘：直接测 ensureDirExists
    await (client as any).ensureDirExists('/backups/')

    expect(mockClient.createDirectory).toHaveBeenCalledTimes(2)
    expect(mockClient.createDirectory).toHaveBeenNthCalledWith(1, '/backups')
    expect(mockClient.createDirectory).toHaveBeenNthCalledWith(2, '/backups')
  })
})
