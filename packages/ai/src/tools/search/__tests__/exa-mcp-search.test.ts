import { describe, it, expect } from 'vitest'
import {
  decodeExaMcpTransport,
  parseExaLabeledResultBlocks,
  parseExaMcpResponse
} from '../exa-mcp-search'

const SSE_FIXTURE =
  'data: {"result":{"content":[{"type":"text","text":"Title: Exa MCP Title\\nURL: https://mcp.exa.ai/result\\nText: Exa MCP Content"}]}}\n'

describe('exa-mcp-search', () => {
  it('decodes SSE JSON-RPC tool result from Exa MCP', () => {
    const items = decodeExaMcpTransport(SSE_FIXTURE)
    expect(items).toHaveLength(1)
    expect(items[0]!.title).toBe('Exa MCP Title')
    expect(items[0]!.url).toBe('https://mcp.exa.ai/result')
    expect(items[0]!.body).toBe('Exa MCP Content')
  })

  it('parses labeled plain-text blocks from web_search_exa', () => {
    const items = parseExaLabeledResultBlocks(
      'Title: Hello\nURL: https://example.com\nText: World content'
    )
    expect(items).toHaveLength(1)
    expect(items[0]!.title).toBe('Hello')
    expect(items[0]!.url).toBe('https://example.com')
    expect(items[0]!.body).toBe('World content')
  })

  it('supports multiline Text bodies', () => {
    const items = parseExaLabeledResultBlocks(
      'Title: Doc\nURL: https://example.com\nText: line one\nline two'
    )
    expect(items[0]!.body).toBe('line one\nline two')
  })

  it('throws when transport has no tool text', () => {
    expect(() => decodeExaMcpTransport('{"error":"bad"}')).toThrow(
      'Exa MCP: no tool result text in response'
    )
  })

  it('keeps legacy parseExaMcpResponse shape', () => {
    const items = parseExaMcpResponse(SSE_FIXTURE)
    expect(items[0]!.text).toBe('Exa MCP Content')
  })
})
