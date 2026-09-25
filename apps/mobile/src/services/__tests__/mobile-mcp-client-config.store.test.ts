import { describe, expect, it, vi } from 'vitest'

vi.mock('../mobile-sandbox-fs', () => ({
  documentDirectory: 'file:///sandbox/',
  getInfoAsync: async () => ({ exists: false, isDirectory: false }),
  readAsStringAsync: async () => {
    throw new Error('missing')
  },
  writeAsStringAsync: async () => undefined
}))

import {
  MOBILE_MCP_CLIENT_CONFIG_FILE,
  getMobileMcpClientConfig,
  resolveMobileMcpClientConfigPath,
  setMobileMcpClientConfig,
  type MobileMcpClientConfigIo
} from '../mobile-mcp-client-config.store'

function memoryIo(initial?: string): MobileMcpClientConfigIo & { files: Map<string, string> } {
  const files = new Map<string, string>()
  const path = `file:///sandbox/${MOBILE_MCP_CLIENT_CONFIG_FILE}`
  if (initial !== undefined) files.set(path, initial)
  return {
    files,
    resolvePath: () => path,
    exists: async (uri) => files.has(uri),
    read: async (uri) => {
      const raw = files.get(uri)
      if (raw === undefined) throw new Error(`missing ${uri}`)
      return raw
    },
    write: async (uri, contents) => {
      files.set(uri, contents)
    }
  }
}

describe('mobile mcp client config store', () => {
  it('should return empty servers when the device file is missing', async () => {
    const io = memoryIo()
    expect(resolveMobileMcpClientConfigPath(io)).toContain(MOBILE_MCP_CLIENT_CONFIG_FILE)
    await expect(getMobileMcpClientConfig(io)).resolves.toEqual({ servers: [] })
  })

  it('should persist a sanitized config and read it back', async () => {
    const io = memoryIo()
    const saved = await setMobileMcpClientConfig(
      {
        servers: [
          {
            id: 'srv-1',
            name: ' 检索 ',
            url: 'http://192.168.1.8:31004/mcp',
            enabled: true,
            authToken: ' tok '
          },
          {
            id: '',
            name: 'bad',
            url: 'http://example.com/mcp',
            enabled: true
          }
        ]
      },
      io
    )
    expect(saved.servers).toHaveLength(1)
    expect(saved.servers[0]?.name).toBe('检索')
    expect(saved.servers[0]?.authToken).toBe(' tok ')
    await expect(getMobileMcpClientConfig(io)).resolves.toEqual(saved)
  })
})
