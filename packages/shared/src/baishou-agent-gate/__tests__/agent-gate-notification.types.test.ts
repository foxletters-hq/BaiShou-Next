import { describe, expect, it } from 'vitest'
import {
  AGENT_GATE_NOTIFICATION_PREVIEW_BODY,
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

  it('builds non-sensitive notification body without session id', () => {
    const body = buildAgentGateNotificationBody()
    expect(body).toBe('需要确认一项操作')
    expect(body).not.toContain('sess_')
    expect(body).not.toContain('workspace_write')
    expect(body).not.toContain('/')
  })

  it('keeps preview copy free of paths and commands', () => {
    expect(AGENT_GATE_NOTIFICATION_PREVIEW_BODY).toContain('已开启')
    expect(AGENT_GATE_NOTIFICATION_PREVIEW_BODY).not.toContain('/')
  })
})
