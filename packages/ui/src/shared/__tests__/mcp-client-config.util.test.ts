import { describe, expect, it } from 'vitest'
import { buildMcpClientJsonExample } from '../mcp-client-config.util'

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
})
