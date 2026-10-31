import { describe, expect, it } from 'vitest'
import {
  buildMcpClientJsonExample,
  buildMcpMultiWorkspaceJsonExample
} from '../mcp-client-config.util'

describe('buildMcpClientJsonExample', () => {
  it('omits headers when auth token is missing', () => {
    const json = buildMcpClientJsonExample('http://127.0.0.1:31004/mcp')
    expect(json).toContain('"url": "http://127.0.0.1:31004/mcp"')
    expect(json).not.toContain('Authorization')
  })

  it('includes bearer header when auth token is present', () => {
    const json = buildMcpClientJsonExample('http://127.0.0.1:31004/sse', 'tok-1', 'sse')
    expect(json).toContain('"url": "http://127.0.0.1:31004/sse"')
    expect(json).toContain('"Authorization": "Bearer tok-1"')
  })

  it('builds multiple mcpServers entries when multiple workspaces are provided', () => {
    const json = buildMcpMultiWorkspaceJsonExample(
      [
        { name: 'Personal', url: 'http://192.168.31.10:31004/mcp?vault=Personal' },
        { name: '演示空间_2', url: 'http://192.168.31.10:31004/mcp?vault=vlt_1288b1828c92e186' }
      ],
      'http://192.168.31.10:31004/mcp'
    )
    expect(json).toContain('"baishou-Personal"')
    expect(json).toContain('"http://192.168.31.10:31004/mcp?vault=Personal"')
    expect(json).toContain('"baishou-演示空间_2"')
    expect(json).toContain('"http://192.168.31.10:31004/mcp?vault=vlt_1288b1828c92e186"')
  })
})
