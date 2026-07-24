import { app } from 'electron'
import * as fsp from 'fs/promises'
import { join } from 'path'
import {
  DEFAULT_AGENT_GATE_NOTIFICATION_PREFS,
  normalizeAgentGateNotificationPrefs,
  type AgentGateNotificationPrefs
} from '@baishou/shared'

export const AGENT_GATE_NOTIFICATION_PREFS_FILE = 'device_agent_gate_notification_prefs.json'

function prefsPath(): string {
  return join(app.getPath('userData'), AGENT_GATE_NOTIFICATION_PREFS_FILE)
}

let cached: AgentGateNotificationPrefs | null = null

export async function getAgentGateNotificationPrefs(): Promise<AgentGateNotificationPrefs> {
  if (cached) return cached
  try {
    const raw = await fsp.readFile(prefsPath(), 'utf8')
    cached = normalizeAgentGateNotificationPrefs(JSON.parse(raw))
    return cached
  } catch {
    cached = { ...DEFAULT_AGENT_GATE_NOTIFICATION_PREFS }
    return cached
  }
}

export async function setAgentGateNotificationPrefs(
  patch: Partial<AgentGateNotificationPrefs>
): Promise<AgentGateNotificationPrefs> {
  const current = await getAgentGateNotificationPrefs()
  const next = normalizeAgentGateNotificationPrefs({ ...current, ...patch })
  cached = next
  const userData = app.getPath('userData')
  await fsp.mkdir(userData, { recursive: true })
  const fullPath = prefsPath()
  const tmpPath = `${fullPath}.tmp`
  await fsp.writeFile(tmpPath, JSON.stringify(next, null, 2), 'utf8')
  try {
    await fsp.rename(tmpPath, fullPath)
  } catch {
    await fsp.writeFile(fullPath, JSON.stringify(next, null, 2), 'utf8')
  }
  return next
}
