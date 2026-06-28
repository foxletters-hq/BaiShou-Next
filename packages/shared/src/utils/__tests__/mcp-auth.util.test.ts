import { describe, expect, it } from 'vitest'
import {
  ensureMcpAuthToken,
  isMcpRequestAuthorized,
  refreshMcpAuthToken
} from '../../utils/mcp-auth.util'

describe('mcp-auth.util', () => {
  it('generates token when enabling MCP without one', () => {
    const next = ensureMcpAuthToken({ mcpEnabled: true, mcpPort: 31004 })
    expect(next.mcpAuthToken).toBeTruthy()
  })

  it('preserves existing token', () => {
    const next = ensureMcpAuthToken({
      mcpEnabled: true,
      mcpPort: 31004,
      mcpAuthToken: 'keep-me'
    })
    expect(next.mcpAuthToken).toBe('keep-me')
  })

  it('authorizes matching bearer token', () => {
    const config = { mcpEnabled: true, mcpPort: 31004, mcpAuthToken: 'secret' }
    expect(isMcpRequestAuthorized(config, 'Bearer secret')).toBe(true)
    expect(isMcpRequestAuthorized(config, 'Bearer wrong')).toBe(false)
  })

  it('allows all requests when token is unset', () => {
    const config = { mcpEnabled: true, mcpPort: 31004 }
    expect(isMcpRequestAuthorized(config, undefined)).toBe(true)
  })

  it('refreshMcpAuthToken replaces existing token', () => {
    const config = { mcpEnabled: true, mcpPort: 31004, mcpAuthToken: 'old-token' }
    const next = refreshMcpAuthToken(config)
    expect(next.mcpAuthToken).toBeTruthy()
    expect(next.mcpAuthToken).not.toBe('old-token')
  })
})
