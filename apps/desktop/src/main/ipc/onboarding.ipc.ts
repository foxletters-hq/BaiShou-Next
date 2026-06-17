import { ipcMain, dialog, app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from '@baishou/shared'

export function registerOnboardingIPC(onComplete: () => void) {
  const settingsPath = path.join(app.getPath('userData'), 'baishou_settings.json')

  ipcMain.handle('onboarding:check', async () => {
    try {
      const data = await fs.readFile(settingsPath, 'utf-8')
      const settings = JSON.parse(data)
      const root = settings.custom_storage_root
      return {
        needsOnboarding: !root || root.trim() === '',
        currentPath: root || path.join(app.getPath('userData'), 'Vaults')
      }
    } catch {
      return {
        needsOnboarding: true,
        currentPath: path.join(app.getPath('userData'), 'Vaults')
      }
    }
  })

  ipcMain.handle('onboarding:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('onboarding:set-directory', async (_, dirPath: string) => {
    let settings: Record<string, unknown> = {}
    try {
      const data = await fs.readFile(settingsPath, 'utf-8')
      settings = JSON.parse(data)
    } catch {}

    settings.custom_storage_root = dirPath
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
    return true
  })

  ipcMain.handle('onboarding:finish', async () => {
    try {
      const data = await fs.readFile(settingsPath, 'utf-8')
      const settings = JSON.parse(data) as { custom_storage_root?: string }
      const dirPath = settings.custom_storage_root?.trim()
      if (dirPath) {
        const { LegacyMigrationService } = await import('../services/legacy-migration.service')
        const { getDesktopInstallInstanceId } = await import('../services/install-instance.service')
        const { isMigrationCompleted } = await import('@baishou/core/shared')
        const { createNodeFileSystem } = await import('@baishou/core-desktop')
        const { connectionManager, installDatabaseSchema } =
          await import('@baishou/database-desktop')
        const { getAppDb, resetAppDb } = await import('../db')

        const legacyService = new LegacyMigrationService()
        const fileSystem = createNodeFileSystem()
        const installInstanceId = await getDesktopInstallInstanceId()

        if (
          (await legacyService.isLegacyAppRoot(dirPath)) &&
          !(await isMigrationCompleted(fileSystem, dirPath, installInstanceId))
        ) {
          logger.info('[Onboarding] Migrating legacy root selected during onboarding:', dirPath)
          await legacyService.migrate(dirPath, dirPath, {
            source: 'flutter_desktop',
            installInstanceId
          })
          resetAppDb()
          const migratedDb = getAppDb(dirPath)
          connectionManager.setDb(migratedDb)
          await installDatabaseSchema(migratedDb)
        }
      }
    } catch (error) {
      logger.error('[Onboarding] Legacy migration on finish failed:', error as Error)
    }

    onComplete()
    return true
  })
}
