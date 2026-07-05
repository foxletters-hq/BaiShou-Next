import { describe, expect, it } from 'vitest'
import {
  MCP_EXPOSABLE_TOOL_IDS,
  isMcpExposableToolId
} from '../mcp-exposable-tool-ids.constants'

describe('mcp-exposable-tool-ids.constants', () => {
  it('includes diary, memory, web, and utility tools for MCP', () => {
    expect(MCP_EXPOSABLE_TOOL_IDS).toContain('diary_read')
    expect(MCP_EXPOSABLE_TOOL_IDS).toContain('diary_write')
    expect(MCP_EXPOSABLE_TOOL_IDS).toContain('vector_search')
    expect(MCP_EXPOSABLE_TOOL_IDS).toContain('web_search')
    expect(MCP_EXPOSABLE_TOOL_IDS).toContain('url_read')
    expect(MCP_EXPOSABLE_TOOL_IDS).toContain('current_time')
  })

  it('does not expose internal-only or app-specific tools', () => {
    expect(isMcpExposableToolId('emoji_send')).toBe(false)
    expect(isMcpExposableToolId('compress_context_upstream')).toBe(false)
  })
})
