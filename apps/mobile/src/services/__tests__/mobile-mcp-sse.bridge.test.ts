import { describe, expect, it } from 'vitest'
import {
  buildSseEndpointEvent,
  buildSseMessageEvent,
  isMcpMessagePath,
  isMcpSsePath,
  parseSseSessionId
} from '../mobile-mcp-sse.util'

describe('mobile-mcp-sse.util', () => {
  it('detects sse and message paths', () => {
    expect(isMcpSsePath('/sse')).toBe(true)
    expect(isMcpSsePath('/sse/')).toBe(true)
    expect(isMcpSsePath('/mcp')).toBe(false)
    expect(isMcpMessagePath('/message')).toBe(true)
    expect(isMcpMessagePath('/message?sessionId=abc')).toBe(true)
    expect(isMcpMessagePath('/mcp')).toBe(false)
  })

  it('parses session id from message path', () => {
    expect(parseSseSessionId('/message?sessionId=abc-123')).toBe('abc-123')
    expect(parseSseSessionId('/message?foo=1&sessionId=xyz')).toBe('xyz')
    expect(parseSseSessionId('/message')).toBeUndefined()
    expect(parseSseSessionId('/message?sessionId=')).toBeUndefined()
  })

  it('builds endpoint and message SSE frames', () => {
    expect(buildSseEndpointEvent('sid-1')).toBe('event: endpoint\ndata: /message?sessionId=sid-1\n\n')
    expect(buildSseMessageEvent({ jsonrpc: '2.0', id: 1, result: {} })).toBe(
      'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{}}\n\n'
    )
  })
})
