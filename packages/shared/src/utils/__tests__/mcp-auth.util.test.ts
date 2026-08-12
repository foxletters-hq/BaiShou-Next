import { describe, expect, it } from 'vitest'
import {
  ensureMcpAuthToken,
  isMcpAuthEnabled,
  isMcpRequestAuthorized,
  refreshMcpAuthToken
} from '../../utils/mcp-auth.util'

describe('mcp-auth.util', () => {
  it('does not generate token when auth is disabled', () => {
    const next = ensureMcpAuthToken({ mcpEnabled: true, mcpPort: 31004, mcpAuthEnabled: false })
    expect(next.mcpAuthToken).toBeUndefined()
  })

  it('generates token when auth is enabled without one', () => {
    const next = ensureMcpAuthToken({ mcpEnabled: true, mcpPort: 31004, mcpAuthEnabled: true })
    expect(next.mcpAuthToken).toBeTruthy()
  })

  it('preserves existing token', () => {
    const next = ensureMcpAuthToken({
      mcpEnabled: true,
      mcpPort: 31004,
      mcpAuthEnabled: true,
      mcpAuthToken: 'keep-me'
    })
    expect(next.mcpAuthToken).toBe('keep-me')
  })

  it('authorizes matching bearer token when auth enabled', () => {
    const config = {
      mcpEnabled: true,
      mcpPort: 31004,
      mcpAuthEnabled: true,
      mcpAuthToken: 'secret'
    }
    expect(isMcpRequestAuthorized(config, 'Bearer secret')).toBe(true)
    expect(isMcpRequestAuthorized(config, 'Bearer wrong')).toBe(false)
  })

  it('allows all requests when auth is disabled even if token exists', () => {
    const config = {
      mcpEnabled: true,
      mcpPort: 31004,
      mcpAuthEnabled: false,
      mcpAuthToken: 'secret'
    }
    expect(isMcpRequestAuthorized(config, undefined)).toBe(true)
    expect(isMcpRequestAuthorized(config, 'Bearer wrong')).toBe(true)
  })

  it('allows all requests when auth enabled but token is unset', () => {
    const config = { mcpEnabled: true, mcpPort: 31004, mcpAuthEnabled: true }
    expect(isMcpRequestAuthorized(config, undefined)).toBe(true)
  })

  it('treats missing mcpAuthEnabled as disabled', () => {
    expect(isMcpAuthEnabled({})).toBe(false)
    expect(isMcpRequestAuthorized({ mcpEnabled: true, mcpPort: 31004, mcpAuthToken: 'x' }, undefined)).toBe(
      true
    )
  })

  it('refreshMcpAuthToken replaces existing token', () => {
    const config = { mcpEnabled: true, mcpPort: 31004, mcpAuthToken: 'old-token' }
    const next = refreshMcpAuthToken(config)
    expect(next.mcpAuthToken).toBeTruthy()
    expect(next.mcpAuthToken).not.toBe('old-token')
  })
})
