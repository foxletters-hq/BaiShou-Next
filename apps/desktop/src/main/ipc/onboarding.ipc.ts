import { ipcMain, dialog, app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from '@baishou/shared'
import {
  defaultOnboardingStoragePath,
  resolveDesktopStorageBootstrap,
  resolvePickedStorageDirectory
} from '../services/desktop-legacy-bootstrap.service'
import { resolveLegacyRootCandidates } from '../services/flutter-legacy-paths.service'
import { isDesktopDevBuild } from '../app-identity'

export function registerOnboardingIPC(onComplete: () => void) {
  const settingsPath = path.join(app.getPath('userData'), 'baishou_settings.json')

  ipcMain.handle('onboarding:check', async () => {
    try {
      const bootstrap = await resolveDesktopStorageBootstrap(settingsPath)
      const legacyCandidates = await resolveLegacyRootCandidates()
      const legacyRoot = legacyCandidates[0] ?? null
      const root = bootstrap.storageRoot?.trim()

      let currentPath: string
      if (root) {
        currentPath = root
      } else if (bootstrap.needsOnboarding && isDesktopDevBuild()) {
        currentPath = defaultOnboardingStoragePath()
      } else {
        currentPath = legacyRoot || defaultOnboardingStoragePath()
      }

      return {
        needsOnboarding: bootstrap.needsOnboarding,
        currentPath
      }
    } catch {
      const legacyCandidates = await resolveLegacyRootCandidates().catch(() => [])
      return {
        needsOnboarding: true,
        currentPath: isDesktopDevBuild()
          ? defaultOnboardingStoragePath()
          : legacyCandidates[0] || defaultOnboardingStoragePath()
      }
    }
  })

  ipcMain.handle('onboarding:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return resolvePickedStorageDirectory(result.filePaths[0])
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
    let settings: { custom_storage_root?: string } = {}
    try {
      const data = await fs.readFile(settingsPath, 'utf-8')
      settings = JSON.parse(data) as { custom_storage_root?: string }
    } catch {
      /* first launch — create settings file below */
    }

    // 用户未手动改路径时，渲染进程可能未调用 set-directory；在此兜底持久化默认路径
    if (!settings.custom_storage_root?.trim()) {
      settings.custom_storage_root = path.join(app.getPath('userData'), 'Vaults')
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
      logger.info('[Onboarding] Persisted default storage root:', settings.custom_storage_root)
    }

    try {
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
