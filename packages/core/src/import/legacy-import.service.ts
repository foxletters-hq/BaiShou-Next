import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { app } from 'electron'
import type { SettingsRepository, UserProfileRepository } from '@baishou/database'
import { restoreLegacyDevicePreferences } from './legacy-config-restore.shared'

/**
 * 桌面端旧版配置恢复（Electron userData 用于 base64 头像落盘）
 */
export class LegacyImportService {
  constructor(
    private readonly settingsRepo: SettingsRepository,
    private readonly profileRepo: UserProfileRepository
  ) {}

  async restoreConfig(config: Record<string, unknown>): Promise<void> {
    await restoreLegacyDevicePreferences(this.settingsRepo, this.profileRepo, config, {
      importAvatarBase64: async (base64, ext) => {
        const buffer = Buffer.from(base64, 'base64')
        const userDataPath = app.getPath('userData')
        const avatarsDir = path.join(userDataPath, 'avatars')
        if (!existsSync(avatarsDir)) {
          await fs.mkdir(avatarsDir, { recursive: true })
        }
        const newPath = path.join(userDataPath, 'avatars', `avatar_imported_${Date.now()}.${ext}`)
        await fs.writeFile(newPath, buffer)
        return newPath
      }
    })
  }
}
