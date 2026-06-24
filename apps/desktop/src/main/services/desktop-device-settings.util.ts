import type { SettingsRepository } from '@baishou/database-desktop'
import { HOTKEY_CONFIG_SETTINGS_KEY } from './desktop-hotkey-config.store'
import { MCP_CONFIG_SETTINGS_KEY } from './desktop-mcp-config.store'

/** 已迁移到 userData 独立 JSON、不应留在共享 Agent DB 的设置键 */
export const DESKTOP_DEVICE_LOCAL_AGENT_DB_KEYS = [
  HOTKEY_CONFIG_SETTINGS_KEY,
  MCP_CONFIG_SETTINGS_KEY
] as const

/**
 * 从共享 Agent DB 清除设备级设置残留（归档恢复 / 旧版导入可能写回）。
 * 不影响 cloud_sync 等仍保存在 SQLite、但不写入 vault 同步文件的键。
 */
export async function purgeDeviceLocalSettingsFromAgentDb(
  settingsRepo: SettingsRepository,
  flushSharedSettings?: () => Promise<void>
): Promise<void> {
  let changed = false
  for (const key of DESKTOP_DEVICE_LOCAL_AGENT_DB_KEYS) {
    const legacy = await settingsRepo.get(key)
    if (legacy !== null && legacy !== undefined) {
      await settingsRepo.delete(key)
      changed = true
    }
  }
  if (changed && flushSharedSettings) {
    await flushSharedSettings()
  }
}
