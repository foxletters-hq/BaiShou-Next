import { dialog, ipcMain } from 'electron'
import { createNodeFileSystem } from '@baishou/core-desktop'
import { isLegacyAppRoot } from '@baishou/core/shared'
import type {
  LegacyMigrationImportResult,
  LegacyMigrationImportSelection,
  LegacyMigrationScanResult
} from '@baishou/shared'
import { legacySelectiveMigrationService } from '../services/legacy-selective-migration.service'

const fileSystem = createNodeFileSystem()

export function registerLegacyMigrationIPC(): void {
  ipcMain.handle(
    'legacyMigration:scan',
    async (event, sourceDir?: string): Promise<LegacyMigrationScanResult> => {
      if (sourceDir != null && typeof sourceDir !== 'string') {
        throw new Error('无效的路径参数')
      }
      return legacySelectiveMigrationService.scan(sourceDir, (progress) => {
        event.sender.send('legacyMigration:progress', progress)
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
    return picked
  })

  ipcMain.handle(
    'legacyMigration:import',
    async (
      event,
      sourceDir: string,
      selection: LegacyMigrationImportSelection
    ): Promise<LegacyMigrationImportResult> => {
      if (typeof sourceDir !== 'string' || !sourceDir.trim()) {
        throw new Error('请指定旧版数据目录')
      }
      return legacySelectiveMigrationService.importSelected(sourceDir, selection, (progress) => {
        event.sender.send('legacyMigration:progress', progress)
      })
    }
  )

  ipcMain.handle('legacyMigration:cancel', async () => {
    legacySelectiveMigrationService.cancel()
    return { success: true }
  })
}
