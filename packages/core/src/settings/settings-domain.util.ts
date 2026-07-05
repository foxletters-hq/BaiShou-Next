import { USER_PROFILE_SETTINGS_KEY } from '@baishou/shared'

/** 不同步到 vault 设置目录的键（仅保留在设备侧 SQLite / 本机私有目录） */
export const SETTINGS_SYNC_EXCLUDED_KEYS = new Set([
  'cloud_sync_config',
  'incremental_sync_config',
  /** 桌面全局快捷键：按安装实例保存在 userData，不随工作区共享 */
  'hotkey_config',
  /** 桌面 MCP 服务（端口/令牌）：按安装实例保存，避免 dev/稳定版互相覆盖 */
  'mcp_server_config'
])

const DOMAIN_FILE_BY_KEY: Record<string, string> = {
  ai_providers: 'ai_providers.json',
  global_models: 'global_models.json',
  [USER_PROFILE_SETTINGS_KEY]: 'user_profile.json',
  user_profile: 'user_profile.json',
  prompt_shortcuts_v2: 'prompt_shortcuts.json',
  prompt_shortcuts: 'prompt_shortcuts.json'
}

/** 所有合法的 settings 域文件名（用于写入时清理空域、避免残留键复活） */
export const SETTINGS_DOMAIN_FILE_NAMES = new Set<string>([
  'app_preferences.json',
  ...new Set(Object.values(DOMAIN_FILE_BY_KEY))
])

export const LEGACY_SETTINGS_FILENAME = 'settings.json'
export const LEGACY_SETTINGS_MIGRATED_SUFFIX = '.migrated'

export function getSettingsDomainFileName(key: string): string {
  return DOMAIN_FILE_BY_KEY[key] ?? 'app_preferences.json'
}

export function groupSettingsByDomainFile(
  settingsMap: Record<string, unknown>
): Record<string, Record<string, unknown>> {
  const groups: Record<string, Record<string, unknown>> = {}
  for (const [key, value] of Object.entries(settingsMap)) {
    if (SETTINGS_SYNC_EXCLUDED_KEYS.has(key)) continue
    const fileName = getSettingsDomainFileName(key)
    if (!groups[fileName]) groups[fileName] = {}
    groups[fileName][key] = value
  }
  return groups
}

export function mergeDomainFileContents(
  files: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const content of Object.values(files)) {
    Object.assign(merged, content)
  }
  return merged
}

/** 磁盘域文件 mtime 不新于 SQLite 写入时，跳过 fullResyncFromDisk 覆盖 */
export function shouldApplyDiskSettingsKey(
  diskFileMtimeMs: number | null | undefined,
  sqliteUpdatedAt: Date | null | undefined
): boolean {
  if (sqliteUpdatedAt == null) return true
  const dbMs = sqliteUpdatedAt.getTime()
  if (!Number.isFinite(dbMs)) return true
  if (diskFileMtimeMs == null || diskFileMtimeMs <= 0) return true
  return diskFileMtimeMs >= dbMs
}
