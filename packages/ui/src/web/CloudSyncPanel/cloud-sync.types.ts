export type DataSyncTab = 'cloud' | 'snapshot' | 'local'

export type SyncTarget = 'local' | 's3' | 'webdav'

export interface SyncConfig {
  target: SyncTarget
  maxBackupCount: number
  maxSnapshotCount?: number
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavPath: string
  s3Endpoint: string
  s3Region: string
  s3Bucket: string
  s3Path: string
  s3AccessKey: string
  s3SecretKey: string
}

export interface SyncRecord {
  filename: string
  lastModified: string
  sizeInBytes: number
  managed: boolean
}

export interface CloudSyncPanelProps {
  onSyncNow: (config: SyncConfig) => Promise<{ success: boolean; message: string }>
  onListRecords: (config: SyncConfig) => Promise<SyncRecord[]>
  onRestore: (
    config: SyncConfig,
    filename: string
  ) => Promise<{ success: boolean; message: string }>
  onDownloadBackup?: (
    config: SyncConfig,
    filename: string
  ) => Promise<{ success: boolean; message: string }>
  onDeleteRecord: (config: SyncConfig, filename: string) => Promise<boolean>
  onBatchDelete: (config: SyncConfig, filenames: string[]) => Promise<number>
  onRename: (config: SyncConfig, oldName: string, newName: string) => Promise<boolean>
  savedConfig?: SyncConfig
  onSaveConfig?: (config: SyncConfig) => void
  onListSnapshots?: () => Promise<SyncRecord[]>
  onRestoreSnapshot?: (filename: string) => Promise<{ success: boolean; message: string }>
  onDeleteSnapshot?: (filename: string) => Promise<boolean>
  onBatchDeleteSnapshots?: (filenames: string[]) => Promise<number>
  onRenameSnapshot?: (oldName: string, newName: string) => Promise<boolean>
  onExportZip?: () => Promise<void>
  onImportZip?: (filePath: string) => Promise<void>
  onPickArchiveFile?: () => Promise<string | null>
}
