import { describe, expect, it } from 'vitest'
import {
  buildExternalMcpToolId,
  formatMcpClientToolResult,
  isMcpClientTimeoutMessage,
  mcpClientProbeReasonFromError,
  normalizeMcpStreamableUrl,
  resolveMcpClientCardStatusKind,
  sanitizeMcpClientConfig,
  toMcpClientListedTools,
  upsertMcpClientServerStatus
} from '../mcp-client-url.util'

describe('normalizeMcpStreamableUrl', () => {
  it('appends /mcp when the path is empty', () => {
    expect(normalizeMcpStreamableUrl('http://127.0.0.1:31004')).toEqual({
      ok: true,
      url: 'http://127.0.0.1:31004/mcp'
    })
  })

  it('keeps an existing /mcp path', () => {
    expect(normalizeMcpStreamableUrl('https://example.com/v1/mcp/')).toEqual({
      ok: true,
      url: 'https://example.com/v1/mcp'
    })
  })

  it('rejects SSE endpoints', () => {
    expect(normalizeMcpStreamableUrl('http://127.0.0.1:31004/sse')).toEqual({
      ok: false,
      reason: 'sse'
    })
  })

  it('rejects empty or non-http urls', () => {
    expect(normalizeMcpStreamableUrl('')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeMcpStreamableUrl('not-a-url')).toEqual({ ok: false, reason: 'invalid' })
    expect(normalizeMcpStreamableUrl('file:///tmp/mcp')).toEqual({ ok: false, reason: 'invalid' })
  })
})

describe('mcp client helpers', () => {
  it('builds a letter-number-underscore tool id', () => {
    expect(buildExternalMcpToolId('my-server', 'browser.navigate')).toBe(
      'mcp_my_server_browser_navigate'
    )
  })

  it('formats text content and error flags', () => {
    expect(
      formatMcpClientToolResult({
        content: [{ type: 'text', text: 'hello' }]
      })
    ).toBe('hello')
    expect(
      formatMcpClientToolResult({
        isError: true,
        content: [{ type: 'text', text: 'boom' }]
      })
    ).toBe('Error: boom')
  })
})

describe('sanitizeMcpClientConfig', () => {
  it('keeps valid /mcp entries and drops sse or invalid urls', () => {
    expect(
      sanitizeMcpClientConfig({
        servers: [
          { id: 'a', name: 'Alpha', url: 'http://127.0.0.1:31004', enabled: true },
          { id: 'b', name: 'SSE', url: 'http://127.0.0.1:31004/sse', enabled: true },
          { id: 'a', name: 'Dup', url: 'http://127.0.0.1:9/mcp', enabled: true }
        ]
      })
    ).toEqual({
      servers: [
        {
          id: 'a',
          name: 'Alpha',
          url: 'http://127.0.0.1:31004/mcp',
          enabled: true
        }
      ]
    })
  })
})

describe('mcp client status helpers', () => {
  it('normalizes tool names from strings or objects', () => {
    expect(
      toMcpClientListedTools([
        'search',
        { name: 'read', description: '读取文件' },
        { name: '' },
        12
      ])
    ).toEqual([
      { name: 'search' },
      { name: 'read', description: '读取文件' }
    ])
  })

  it('replaces an existing server status by id', () => {
    expect(
      upsertMcpClientServerStatus(
        [{ id: 'a', connected: false, tools: [] }],
        { id: 'a', connected: true, tools: [{ name: 'search' }] }
      )
    ).toEqual([{ id: 'a', connected: true, tools: [{ name: 'search' }] }])
  })

  it('classifies timeout messages from Chinese or English errors', () => {
    expect(isMcpClientTimeoutMessage('获取工具超时')).toBe(true)
    expect(isMcpClientTimeoutMessage('连接超时')).toBe(true)
    expect(isMcpClientTimeoutMessage('Request timed out')).toBe(true)
    expect(isMcpClientTimeoutMessage('MCP error -32001: Request timed out')).toBe(true)
    expect(isMcpClientTimeoutMessage('连接失败')).toBe(false)
    expect(mcpClientProbeReasonFromError(new Error('获取工具超时'))).toBe('timeout')
    expect(mcpClientProbeReasonFromError(new Error('ECONNREFUSED'))).toBe('connect')
  })

  it('keeps loading until timeout, then shows timeout instead of hanging', () => {
    expect(
      resolveMcpClientCardStatusKind({
        enabled: true,
        connected: false,
        loading: true,
        timedOut: false
      })
    ).toBe('loading')
    expect(
      resolveMcpClientCardStatusKind({
        enabled: true,
        connected: false,
        loading: false,
        timedOut: true
      })
    ).toBe('timeout')
    expect(
      resolveMcpClientCardStatusKind({
        enabled: true,
        connected: true,
        loading: false,
        timedOut: true
      })
    ).toBe('connected')
  })
})
