import { ipcRenderer } from 'electron'
import type {
  LegacyMigrationProgressEvent,
  LegacyVersionMigrationBatchImportResult,
  LegacyVersionMigrationImportResult,
  LegacyVersionMigrationScanPayload,
  LegacyVersionMigrationSectionId
} from '@baishou/shared'

export const legacyMigrationApi = {
  legacyMigration: {
    scan: (customSourceRoot?: string | null): Promise<LegacyVersionMigrationScanPayload> =>
      ipcRenderer.invoke('legacyMigration:scan', customSourceRoot),
    pickSource: (): Promise<string | null> => ipcRenderer.invoke('legacyMigration:pickSource'),
    clearCustomSource: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('legacyMigration:clearCustomSource'),
    importSection: (
      sectionId: LegacyVersionMigrationSectionId,
      customSourceRoot?: string | null
    ): Promise<LegacyVersionMigrationImportResult> =>
      ipcRenderer.invoke('legacyMigration:importSection', sectionId, customSourceRoot),
    importAllWorkspaces: (
      sectionIds: LegacyVersionMigrationSectionId[],
      customSourceRoot?: string | null
    ): Promise<LegacyVersionMigrationBatchImportResult> =>
      ipcRenderer.invoke('legacyMigration:importAllWorkspaces', sectionIds, customSourceRoot),
    cancel: (): Promise<{ success: boolean }> => ipcRenderer.invoke('legacyMigration:cancel'),
    onProgress: (callback: (event: LegacyMigrationProgressEvent) => void) => {
      const handler = (_: unknown, event: LegacyMigrationProgressEvent) => callback(event)
      ipcRenderer.on('legacyMigration:progress', handler)
      return () => ipcRenderer.off('legacyMigration:progress', handler)
    }
  }
}
