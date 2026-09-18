import { describe, expect, it } from 'vitest'
import {
  MCP_CLIENT_CONNECT_TIMEOUT_MESSAGE,
  MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE,
  MCP_CLIENT_NOT_CONNECTED_MESSAGE,
  MCP_CLIENT_TIMEOUT_TOKEN
} from '../mcp-client-wire.constants'

describe('mcp-client-wire.constants', () => {
  it('keeps timeout tokens that the probe matcher depends on', () => {
    expect(MCP_CLIENT_CONNECT_TIMEOUT_MESSAGE).toContain(MCP_CLIENT_TIMEOUT_TOKEN)
    expect(MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE).toContain(MCP_CLIENT_TIMEOUT_TOKEN)
    expect(MCP_CLIENT_NOT_CONNECTED_MESSAGE).not.toContain(MCP_CLIENT_TIMEOUT_TOKEN)
  })
})
