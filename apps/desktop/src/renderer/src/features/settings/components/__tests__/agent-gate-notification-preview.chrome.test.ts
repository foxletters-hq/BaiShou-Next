import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('agent gate notification prefs preview', () => {
  it('should send a preview notification when the user turns the switch on', () => {
    const hook = read('../useBaishouAgentGateSettings.ts')
    const companion = read('../CompanionChatToolsPane.tsx')
    const client = read('../agent-gate-notification-prefs.client.ts')
    expect(hook).toContain('persistDesktopAgentGateNotificationPrefs')
    expect(companion).toContain('persistDesktopAgentGateNotificationPrefs')
    expect(client).toContain('previewNotification')
    expect(client).toContain('patch.enabled')
  })

  it('should explain the workbench system notification switch like companion chat', () => {
    const panel = read('../WorkspaceGatePermissionsPanel.tsx')
    expect(panel).toContain('settings-list-tile-subtitle')
    expect(panel).toContain('settings.agent_gate_notifications_hint')
  })

  it('should use the hash session helper instead of treating open as a session id', () => {
    const bridge = read('../../../agent/agent-gate-notification-bridge.ts')
    expect(bridge).toContain('sessionIdFromDesktopLocationHash')
    expect(bridge).not.toMatch(/hash\.match\(\/\^\\\/agent-workspace/)
  })
})
