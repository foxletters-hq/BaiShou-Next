import type { SettingsRepository, UserProfileRepository } from '@baishou/database'

/** 移动端不依赖 Electron，旧版导入仅在桌面端可用 */
export class LegacyImportService {
  constructor(_settingsRepo: SettingsRepository, _profileRepo: UserProfileRepository) {}

  async restoreConfig(_config: Record<string, unknown>): Promise<void> {
    throw new Error('LegacyImportService is only available on desktop')
  }
}
