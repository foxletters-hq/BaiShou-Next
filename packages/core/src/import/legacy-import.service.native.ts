import type { SettingsRepository, UserProfileRepository } from '@baishou/database'
import { restoreLegacyDevicePreferences } from './legacy-config-restore.shared'

/** 移动端旧版配置恢复（不依赖 Electron） */
export class LegacyImportService {
  constructor(
    private readonly settingsRepo: SettingsRepository,
    private readonly profileRepo: UserProfileRepository
  ) {}

  async restoreConfig(
    config: Record<string, unknown>,
    options?: { skipProfileFields?: boolean }
  ): Promise<void> {
    await restoreLegacyDevicePreferences(this.settingsRepo, this.profileRepo, config, {
      skipProfileFields: options?.skipProfileFields
    })
  }
}
