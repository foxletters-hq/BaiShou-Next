import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IncrementalWebDavClient } from '../incremental-webdav.client'

function createMockWebDavClient() {
  return {
    getDirectoryContents: vi.fn(),
    putFileContents: vi.fn(),
    createReadStream: vi.fn(),
    deleteFile: vi.fn(),
    moveFile: vi.fn(),
    createDirectory: vi.fn(),
    stat: vi.fn()
  }
}

describe('IncrementalWebDavClient.listFiles', () => {
  let mockClient: ReturnType<typeof createMockWebDavClient>

  beforeEach(() => {
    mockClient = createMockWebDavClient()
  })

  it('uses shallow recursive PROPFIND instead of deep listing', async () => {
    mockClient.getDirectoryContents.mockImplementation(async (dir: string) => {
      if (dir === 'memories_sync') {
        return [
          { type: 'directory', filename: 'memories_sync/Personal' },
          {
            type: 'file',
            filename: 'memories_sync/vault_registry.json',
            basename: 'vault_registry.json',
            size: 10
          }
        ]
      }
      if (dir === 'memories_sync/Personal') {
        return [
          {
            type: 'file',
            filename: 'memories_sync/Personal/Journals/a.md',
            basename: 'a.md',
            size: 5,
            lastmod: '2026-01-01T00:00:00Z'
          }
        ]
      }
      return []
    })

    const client = new IncrementalWebDavClient('https://dav.example.com', 'u', 'p', 'memories_sync')
    ;(client as any).client = mockClient
    client.setVaultPath('/vaults')

    const records = await client.listFiles()

    expect(mockClient.getDirectoryContents).toHaveBeenCalledWith('memories_sync', { deep: false })
    expect(mockClient.getDirectoryContents).toHaveBeenCalledWith('memories_sync/Personal', {
      deep: false
    })
    expect(mockClient.getDirectoryContents).not.toHaveBeenCalledWith(expect.anything(), {
      deep: true
    })
    expect(records.map((r) => r.filename).sort()).toEqual([
      'Personal/Journals/a.md',
      'vault_registry.json'
    ])
  })

  it('returns empty array when root is missing', async () => {
    mockClient.getDirectoryContents.mockRejectedValue({ status: 404, message: '404' })

    const client = new IncrementalWebDavClient('https://dav.example.com', 'u', 'p', 'memories_sync')
    ;(client as any).client = mockClient

    await expect(client.listFiles()).resolves.toEqual([])
  })

  it('creates path prefix directory before listing', async () => {
    mockClient.getDirectoryContents.mockResolvedValue([])

    const client = new IncrementalWebDavClient('https://dav.example.com', 'u', 'p', 'memories_sync')
    ;(client as any).client = mockClient

    await client.listFiles()

    expect(mockClient.createDirectory).toHaveBeenCalledWith('memories_sync')
  })

  it('creates nested path prefix segments before listing', async () => {
    mockClient.getDirectoryContents.mockResolvedValue([])

    const client = new IncrementalWebDavClient(
      'https://dav.example.com',
      'u',
      'p',
      'apps/baishou/sync'
    )
    ;(client as any).client = mockClient

    await client.listFiles()

    expect(mockClient.createDirectory).toHaveBeenCalledWith('apps')
    expect(mockClient.createDirectory).toHaveBeenCalledWith('apps/baishou')
    expect(mockClient.createDirectory).toHaveBeenCalledWith('apps/baishou/sync')
  })
})
