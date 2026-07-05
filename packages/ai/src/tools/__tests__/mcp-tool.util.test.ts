import { describe, expect, it } from 'vitest'
import {
  MCP_EXTERNAL_SESSION_ID,
  buildMcpInstructions,
  formatMcpToolCallResult,
  isMcpToolErrorResult
} from '../mcp-tool.util'

describe('mcp-tool.util', () => {
  it('defines the MCP external session id', () => {
    expect(MCP_EXTERNAL_SESSION_ID).toBe('mcp-external')
  })

  it('buildMcpInstructions includes workspace name', () => {
    expect(buildMcpInstructions('雪日记')).toContain('Current workspace: 雪日记')
  })

  it('detects Error: prefixed tool failures', () => {
    expect(isMcpToolErrorResult('Error: diary not found')).toBe(true)
    expect(isMcpToolErrorResult('Successfully created diary entry')).toBe(false)
  })

  it('formatMcpToolCallResult sets isError for failures', () => {
    const ok = formatMcpToolCallResult('Successfully created diary entry for 2026-06-16.')
    expect(ok.isError).toBe(false)

    const err = formatMcpToolCallResult('Error: Failed to create diary entry')
    expect(err.isError).toBe(true)
    expect(err.content[0]?.text).toContain('Error:')
  })
})
