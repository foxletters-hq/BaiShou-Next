import { ipcRenderer } from 'electron'
import type {
  LegacyMigrationImportResult,
  LegacyMigrationImportSelection,
  LegacyMigrationProgressEvent,
  LegacyMigrationScanResult
} from '@baishou/shared'

export const legacyMigrationApi = {
  legacyMigration: {
    scan: (sourceDir?: string): Promise<LegacyMigrationScanResult> =>
      ipcRenderer.invoke('legacyMigration:scan', sourceDir),
    pickSource: (): Promise<string | null> => ipcRenderer.invoke('legacyMigration:pickSource'),
    import: (
      sourceDir: string,
      selection: LegacyMigrationImportSelection
    ): Promise<LegacyMigrationImportResult> =>
      ipcRenderer.invoke('legacyMigration:import', sourceDir, selection),
    cancel: (): Promise<{ success: boolean }> => ipcRenderer.invoke('legacyMigration:cancel'),
    onProgress: (callback: (event: LegacyMigrationProgressEvent) => void) => {
      const handler = (_: unknown, event: LegacyMigrationProgressEvent) => callback(event)
      ipcRenderer.on('legacyMigration:progress', handler)
      return () => ipcRenderer.off('legacyMigration:progress', handler)
    }
  }
}
