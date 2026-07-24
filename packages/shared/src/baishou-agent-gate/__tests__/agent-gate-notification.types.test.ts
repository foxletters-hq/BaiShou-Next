import { describe, expect, it } from 'vitest'
import {
  buildAgentGateNotificationBody,
  normalizeAgentGateNotificationPrefs
} from '../agent-gate-notification.types'

describe('agent-gate-notification.types', () => {
  it('normalizes prefs with defaults', () => {
    expect(normalizeAgentGateNotificationPrefs(null)).toEqual({
      enabled: true,
      soundEnabled: true
    })
    expect(normalizeAgentGateNotificationPrefs({ enabled: false })).toEqual({
      enabled: false,
      soundEnabled: true
    })
  })

  it('builds non-sensitive notification body', () => {
    const body = buildAgentGateNotificationBody('sess_abcdefghijk')
    expect(body).toContain('需要确认一项操作')
    expect(body).not.toContain('workspace_write')
    expect(body).not.toContain('/')
  })
})
