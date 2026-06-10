import { describe, it, expect } from 'vitest'
import { parseExaMcpResponse, parseExaMcpTextChunk } from '../exa-mcp-search'

const SSE_FIXTURE =
  'data: {"result":{"content":[{"type":"text","text":"Title: Exa MCP Title\\nURL: https://mcp.exa.ai/result\\nText: Exa MCP Content"}]}}\n'

describe('exa-mcp-search', () => {
  it('parses SSE response from Exa MCP', () => {
    const items = parseExaMcpResponse(SSE_FIXTURE)
    expect(items).toHaveLength(1)
    expect(items[0]!.title).toBe('Exa MCP Title')
    expect(items[0]!.url).toBe('https://mcp.exa.ai/result')
    expect(items[0]!.text).toBe('Exa MCP Content')
  })

  it('parses plain Title/URL/Text chunks', () => {
    const items = parseExaMcpTextChunk(
      'Title: Hello\nURL: https://example.com\nText: World content'
    )
    expect(items).toHaveLength(1)
    expect(items[0]!.title).toBe('Hello')
    expect(items[0]!.url).toBe('https://example.com')
    expect(items[0]!.text).toBe('World content')
  })

  it('throws when response has no parseable content', () => {
    expect(() => parseExaMcpResponse('{"error":"bad"}')).toThrow('Exa MCP response parsing failed')
  })
})
