import { describe, expect, it } from 'vitest'
import { sessionIdFromDesktopLocationHash } from '../agent-gate-session-from-hash.util'

describe('sessionIdFromDesktopLocationHash', () => {
  it('should read companion chat session ids from the hash', () => {
    expect(sessionIdFromDesktopLocationHash('#/chat/sess_abc')).toBe('sess_abc')
  })

  it('should read workbench session ids and ignore directory segments', () => {
    expect(sessionIdFromDesktopLocationHash('#/agent-workspace/sess_ws')).toBe('sess_ws')
    expect(sessionIdFromDesktopLocationHash('#/agent-workspace/open/ws_1')).toBeNull()
    expect(sessionIdFromDesktopLocationHash('#/agent-workspace/knowledge')).toBeNull()
    expect(sessionIdFromDesktopLocationHash('#/agent-workspace/skills')).toBeNull()
    expect(sessionIdFromDesktopLocationHash('#/agent-workspace')).toBeNull()
  })
})
