import { describe, expect, it } from 'vitest'
import {
  ensureMcpAuthToken,
  isMcpAuthEnabled,
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

  it('does not generate token when auth is disabled', () => {
    const next = ensureMcpAuthToken({
      mcpEnabled: true,
      mcpPort: 31004,
      mcpAuthEnabled: false
    })
    expect(next.mcpAuthToken).toBeUndefined()
  })

  it('treats missing mcpAuthEnabled as enabled', () => {
    expect(isMcpAuthEnabled({ mcpEnabled: true, mcpPort: 31004 })).toBe(true)
    expect(isMcpAuthEnabled({ mcpEnabled: true, mcpPort: 31004, mcpAuthEnabled: false })).toBe(
      false
    )
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

  it('allows all requests when auth is disabled even with a stored token', () => {
    const config = {
      mcpEnabled: true,
      mcpPort: 31004,
      mcpAuthEnabled: false,
      mcpAuthToken: 'secret'
    }
    expect(isMcpRequestAuthorized(config, undefined)).toBe(true)
    expect(isMcpRequestAuthorized(config, 'Bearer wrong')).toBe(true)
  })

  it('refreshMcpAuthToken replaces existing token and re-enables auth', () => {
    const config = {
      mcpEnabled: true,
      mcpPort: 31004,
      mcpAuthEnabled: false,
      mcpAuthToken: 'old-token'
    }
    const next = refreshMcpAuthToken(config)
    expect(next.mcpAuthEnabled).toBe(true)
    expect(next.mcpAuthToken).toBeTruthy()
    expect(next.mcpAuthToken).not.toBe('old-token')
  })
})
