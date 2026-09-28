import { describe, expect, it } from 'vitest'
import { buildMcpSseUrl, buildMcpUrl } from '../mcp-url'

describe('mcp-url', () => {
  it('builds streamable http url', () => {
    expect(buildMcpUrl(31004)).toBe('http://127.0.0.1:31004/mcp')
    expect(buildMcpUrl(31004, '192.168.1.8')).toBe('http://192.168.1.8:31004/mcp')
  })

  it('builds sse url with host', () => {
    expect(buildMcpSseUrl(31004)).toBe('http://127.0.0.1:31004/sse')
    expect(buildMcpSseUrl(31005, '10.0.0.2')).toBe('http://10.0.0.2:31005/sse')
  })
})
