import { describe, expect, it } from 'vitest'
import {
  OPENCODE_GO_SESSION_HEADER,
  OPENCODE_GO_USER_AGENT,
  resolveOpenCodeGoSessionId,
  withOpenCodeGoHeaders
} from '../opencodego.headers'

describe('OpenCode Go request headers', () => {
  it('overrides generic SDK user-agent and sets a stable session header', () => {
    const init = withOpenCodeGoHeaders(
      { headers: { 'User-Agent': 'ai-sdk/openai/3.0.50', Authorization: 'Bearer key' } },
      'session-123'
    )
    const headers = new Headers(init.headers)

    expect(headers.get('User-Agent')).toBe(OPENCODE_GO_USER_AGENT)
    expect(headers.get(OPENCODE_GO_SESSION_HEADER)).toBe('session-123')
    expect(headers.get('Authorization')).toBe('Bearer key')
  })

  it('reuses an explicit session id and fills in a fallback when missing', () => {
    expect(resolveOpenCodeGoSessionId('  conv-1  ')).toBe('conv-1')
    expect(resolveOpenCodeGoSessionId()).toMatch(/^[0-9a-f-]{36}$|^baishou-/)
  })
})
