import { describe, expect, it, vi } from 'vitest'
import { MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE } from '@baishou/shared'
import {
  defaultMcpClientNameFromUrl,
  mcpClientStatusById,
  newMcpClientServerId,
  parseMcpClientUrl,
  withStatusFetchTimeout
} from '../mcp-client-servers.util'

describe('parseMcpClientUrl', () => {
  it('should accept an http /mcp address and reject sse or empty input', () => {
    const ok = parseMcpClientUrl('http://127.0.0.1:31004/mcp')
    expect(ok).toEqual({ url: 'http://127.0.0.1:31004/mcp' })
    expect(parseMcpClientUrl('')).toEqual({ error: 'empty' })
    expect(parseMcpClientUrl('http://127.0.0.1:31004/sse')).toEqual({ error: 'sse' })
  })
})

describe('defaultMcpClientNameFromUrl', () => {
  it('should use the hostname and fall back when the url is invalid', () => {
    expect(defaultMcpClientNameFromUrl('http://search.local/mcp')).toBe('search.local')
    expect(defaultMcpClientNameFromUrl('not-a-url')).toBe('MCP')
  })
})

describe('newMcpClientServerId', () => {
  it('should prefer crypto.randomUUID and otherwise compose a fallback id', () => {
    expect(newMcpClientServerId(() => 'uuid-1')).toBe('uuid-1')
    expect(newMcpClientServerId(null, 1700000000000, 0.5)).toBe('mcp-1700000000000-8')
  })
})

describe('mcpClientStatusById', () => {
  it('should index statuses by server id', () => {
    const map = mcpClientStatusById([
      { id: 'a', connected: true, tools: [] },
      { id: 'b', connected: false, tools: [] }
    ])
    expect(map.get('a')?.connected).toBe(true)
    expect(map.get('b')?.connected).toBe(false)
  })
})

describe('withStatusFetchTimeout', () => {
  it('should reject with the shared timeout message when the promise hangs', async () => {
    vi.useFakeTimers()
    const pending = withStatusFetchTimeout(new Promise<string>(() => undefined), 20)
    const assertion = expect(pending).rejects.toThrow(MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE)
    await vi.advanceTimersByTimeAsync(20)
    await assertion
    vi.useRealTimers()
  })

  it('should resolve the original value when it finishes in time', async () => {
    await expect(withStatusFetchTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok')
  })
})
