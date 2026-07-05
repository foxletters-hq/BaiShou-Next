import { ipcMain, dialog, app } from 'electron'
import { logger } from '@baishou/shared'
import {
  defaultOnboardingStoragePath,
  dismissDesktopLegacyMigrationPrompt,
  finishDesktopOnboarding,
  resolveDesktopStorageBootstrap,
  resolvePendingFlutterLegacyMigration,
  resolvePickedStorageDirectory,
  runDesktopFlutterLegacyMigration,
  validateFlutterLegacyMigrationTarget,
  writeDesktopOnboardingDirectory
} from '../services/desktop-legacy-bootstrap.service'
import { resolveLegacyRootCandidates } from '../services/flutter-legacy-paths.service'
import { isDesktopDevBuild } from '../app-identity'
import * as path from 'path'

export function registerOnboardingIPC(onComplete: () => void) {
  const settingsPath = path.join(app.getPath('userData'), 'baishou_settings.json')

  ipcMain.handle('onboarding:check', async () => {
    try {
      const bootstrap = await resolveDesktopStorageBootstrap(settingsPath)
      const pending = await resolvePendingFlutterLegacyMigration(settingsPath)

      const root = bootstrap.storageRoot?.trim()
      const currentPath = root || defaultOnboardingStoragePath()

      return {
        needsOnboarding: bootstrap.needsOnboarding,
        currentPath,
        pendingFlutterLegacyMigration: pending
      }
    } catch {
      const legacyCandidates = await resolveLegacyRootCandidates().catch(() => [])
      return {
        needsOnboarding: true,
        currentPath: isDesktopDevBuild()
          ? defaultOnboardingStoragePath()
          : legacyCandidates[0] || defaultOnboardingStoragePath(),
        pendingFlutterLegacyMigration: null
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
    await writeDesktopOnboardingDirectory(settingsPath, dirPath)
    return true
  })

  ipcMain.handle('onboarding:dismiss-legacy-migration-prompt', async () => {
    await dismissDesktopLegacyMigrationPrompt()
    return true
  })

  ipcMain.handle('onboarding:detect-legacy-pending', async () => {
    const pending = await resolvePendingFlutterLegacyMigration(settingsPath)
    return { pendingFlutterLegacyMigration: pending }
  })

  ipcMain.handle(
    'onboarding:run-flutter-legacy-migration',
    async (
      _,
      payload: { sourceRoot: string; targetRoot: string }
    ): Promise<{ success: boolean }> => {
      const sourceRoot = payload?.sourceRoot?.trim()
      const targetRoot = payload?.targetRoot?.trim()
      if (!sourceRoot || !targetRoot) {
        throw new Error('Invalid migration paths')
      }

      const safeTarget = validateFlutterLegacyMigrationTarget(targetRoot)

      logger.info(
        `[Onboarding] User confirmed Flutter legacy migration from ${sourceRoot} to ${safeTarget}`
      )
      await runDesktopFlutterLegacyMigration(sourceRoot, safeTarget)

      await writeDesktopOnboardingDirectory(settingsPath, safeTarget)
      return { success: true }
    }
  )

  ipcMain.handle('onboarding:finish', async () => {
    await finishDesktopOnboarding(settingsPath)
    onComplete()
    return true
  })
}
