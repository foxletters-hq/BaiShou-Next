import { ipcMain } from 'electron'
import type { SettingsConfigKey } from '@baishou/store'
import { settingsManager } from './settings.ipc'
import { getAutoFixedProviders } from './settings-models.ipc'

const ALL_SNAPSHOT_KEYS: SettingsConfigKey[] = [
  'providers',
  'globalModels',
  'agentBehavior',
  'ragConfig',
  'webSearchConfig',
  'summaryConfig',
  'toolManagementConfig',
  'mcpServerConfig',
  'hotkeyConfig',
  'cloudSyncConfig'
]

async function readSnapshotValue(key: SettingsConfigKey): Promise<unknown> {
  switch (key) {
    case 'providers':
      return getAutoFixedProviders()
    case 'globalModels':
      return settingsManager.get('global_models')
    case 'agentBehavior':
      return (
        (await settingsManager.get('agent_behavior')) ??
        (await settingsManager.get('agent_behavior_config'))
      )
    case 'ragConfig':
      return settingsManager.get('rag_config')
    case 'webSearchConfig':
      return settingsManager.get('web_search_config')
    case 'summaryConfig':
      return settingsManager.get('summary_config')
    case 'toolManagementConfig':
      return settingsManager.get('tool_management_config')
    case 'mcpServerConfig': {
      const { getDesktopMcpServerConfig } = await import('../services/desktop-mcp-config.store')
      return getDesktopMcpServerConfig()
    }
    case 'hotkeyConfig': {
      const { getDesktopHotkeyConfig } = await import('../services/desktop-hotkey-config.store')
      return getDesktopHotkeyConfig()
    }
    case 'cloudSyncConfig':
      return settingsManager.get('cloud_sync_config')
    default:
      return null
  }
}

export function registerSettingsConfigSnapshotIPC() {
  ipcMain.handle('settings:get-config-snapshot', async (_, keys?: SettingsConfigKey[]) => {
    const requested =
      keys && keys.length > 0
        ? [...new Set(keys)].filter((key) => ALL_SNAPSHOT_KEYS.includes(key))
        : ALL_SNAPSHOT_KEYS

    const entries = await Promise.all(
      requested.map(async (key) => [key, await readSnapshotValue(key)] as const)
    )

    return Object.fromEntries(entries) as Partial<Record<SettingsConfigKey, unknown>>
  })
}
