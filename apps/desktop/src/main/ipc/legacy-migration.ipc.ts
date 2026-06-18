import { dialog, ipcMain } from 'electron'
import { createNodeFileSystem } from '@baishou/core-desktop'
import { isLegacyAppRoot } from '@baishou/core/shared'
import type {
  LegacyVersionMigrationBatchImportResult,
  LegacyVersionMigrationImportResult,
  LegacyVersionMigrationScanPayload,
  LegacyVersionMigrationSectionId
} from '@baishou/shared'
import { desktopLegacyVersionMigrationService } from '../services/desktop-legacy-version-migration.service'

const fileSystem = createNodeFileSystem()

export function registerLegacyMigrationIPC(): void {
  ipcMain.handle(
    'legacyMigration:scan',
    async (event, customSourceRoot?: string | null): Promise<LegacyVersionMigrationScanPayload> => {
      if (customSourceRoot != null && typeof customSourceRoot !== 'string') {
        throw new Error('无效的路径参数')
      }
      return desktopLegacyVersionMigrationService.scan(customSourceRoot, (message) => {
        event.sender.send('legacyMigration:progress', { phase: 'scan', message })
      })
    }
  )

  ipcMain.handle('legacyMigration:pickSource', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const picked = result.filePaths[0]
    if (!(await isLegacyAppRoot(fileSystem, picked))) {
      throw new Error('所选目录不是有效的旧版白守数据根目录')
    }
    await desktopLegacyVersionMigrationService.setCustomSource(picked)
    return picked
  })

  ipcMain.handle('legacyMigration:clearCustomSource', async () => {
    await desktopLegacyVersionMigrationService.setCustomSource(null)
    return { success: true }
  })

  ipcMain.handle(
    'legacyMigration:importSection',
    async (
      event,
      sectionId: LegacyVersionMigrationSectionId,
      customSourceRoot?: string | null
    ): Promise<LegacyVersionMigrationImportResult> => {
      if (typeof sectionId !== 'string' || !sectionId.trim()) {
        throw new Error('无效的板块 ID')
      }
      return desktopLegacyVersionMigrationService.importSection(sectionId, {
        legacySourceRoot: customSourceRoot,
        onProgress: (message) => {
          event.sender.send('legacyMigration:progress', {
            phase: 'import',
            section: sectionId,
            message
          })
        }
      })
    }
  )

  ipcMain.handle(
    'legacyMigration:importAllWorkspaces',
    async (
      event,
      sectionIds: LegacyVersionMigrationSectionId[],
      customSourceRoot?: string | null
    ): Promise<LegacyVersionMigrationBatchImportResult> => {
      if (!Array.isArray(sectionIds)) {
        throw new Error('无效的工作空间列表')
      }
      return desktopLegacyVersionMigrationService.importAllWorkspaces(sectionIds, {
        legacySourceRoot: customSourceRoot,
        onProgress: (message) => {
          event.sender.send('legacyMigration:progress', { phase: 'import', message })
        }
      })
    }
  )

  ipcMain.handle('legacyMigration:cancel', async () => {
    desktopLegacyVersionMigrationService.cancel()
    return { success: true }
  })
}
