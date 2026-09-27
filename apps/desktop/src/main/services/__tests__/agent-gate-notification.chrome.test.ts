import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('desktop agent gate system notifications', () => {
  it('should stamp Windows AppUserModelId before ready and ensure a Start Menu shortcut', () => {
    const identity = read('../../app-identity.ts')
    const index = read('../../index.ts')
    const shortcut = read('../windows-toast-identity.ts')
    expect(identity).toContain('setAppUserModelId')
    expect(identity).toContain('DESKTOP_DEV_APP_ID')
    expect(index).toContain('ensureWindowsToastShortcut')
    expect(shortcut).toContain('writeShortcutLink')
    expect(shortcut).toContain('appUserModelId')
  })

  it('should attach the app icon and expose a forced preview when sending toasts', () => {
    const service = read('../agent-gate-notification.service.ts')
    expect(service).toContain('{ icon }')
    expect(service).toContain('previewAgentGateNotification')
    expect(service).toContain('ensureWindowsToastShortcut')
    expect(service).toContain('options?.force')
    expect(service).toContain('buildAgentGateNotificationBody()')
    expect(service).not.toContain('buildAgentGateNotificationBody(request.sessionId)')
  })

  it('should register preview IPC on preload and AgentGateAPI', () => {
    const ipc = read('../../ipc/agent-gate.ipc.ts')
    const preload = read('../../../preload/agent.api.ts')
    const dts = read('../../../renderer/src/global.d.ts')
    expect(ipc).toContain("'agent-gate:preview-notification'")
    expect(ipc).toContain('previewAgentGateNotification')
    expect(preload).toContain('previewNotification')
    expect(preload).toContain("'agent-gate:preview-notification'")
    expect(dts).toContain('previewNotification()')
  })

  it('should subscribe to gate asked events without waiting for companion runtime', () => {
    const gate = read('../agent-gate.service.ts')
    const start = gate.indexOf('export function registerAgentGateEventBridge')
    const fn = gate.slice(start, start + 900)
    expect(fn).toContain('subscribeAgentGateNotificationEvents')
    expect(fn.indexOf('subscribeAgentGateNotificationEvents')).toBeLessThan(
      fn.indexOf('ensureCompanionGateRuntime')
    )
  })

  it('should stamp AppUserModelID on Inno start-menu and desktop shortcuts', () => {
    const iss = read('../../../../setup.iss')
    expect(iss).toContain('AppUserModelID: "com.baishou.baishou"')
    expect(iss).toMatch(/\{group\}\\\{cm:AppName\}[\s\S]*AppUserModelID/)
    expect(iss).toMatch(/\{autodesktop\}\\\{cm:AppName\}[\s\S]*AppUserModelID/)
  })
})
