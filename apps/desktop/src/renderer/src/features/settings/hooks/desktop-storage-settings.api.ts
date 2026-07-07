import type { TFunction } from 'i18next'

export type StorageBusyState =
  | 'idle'
  | 'migrating'
  | 'switching'
  | 'external-journals'
  | 'external-summaries'

export type StorageTargetValidation =
  | { valid: true; sourceRoot: string; hasData: boolean }
  | { valid: false; code: string }

export const OVERLAY_DISMISS_MS = 320

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getStorageApi() {
  return (window as any).api?.storage as
    | {
        getStats?: () => Promise<{
          storageRootPath?: string
          sqliteSizeStats?: string
          vectorDbStats?: string
          mediaCacheStats?: string
        }>
        pickDirectory?: () => Promise<string | null>
        validateTargetDirectory?: (targetPath: string) => Promise<StorageTargetValidation>
        changeDirectory?: (targetPath: string) => Promise<{ ok: boolean }>
        migrateDirectory?: (targetPath: string) => Promise<{ ok: boolean }>
        onMigrationProgress?: (cb: (payload: { name: string }) => void) => () => void
        onRootChanged?: (cb: () => void) => () => void
        getExternalJournalsInfo?: (options?: { includeFileCounts?: boolean }) => Promise<{
          path: string | null
          defaultPath: string
          journalFileCount: number
          pathAvailableOnDevice?: boolean
        }>
        pickExternalJournalsDirectory?: () => Promise<string | null>
        setExternalJournalsDirectory?: (targetPath: string) => Promise<{
          ok: boolean
          journalFileCount?: number
        }>
        clearExternalJournalsDirectory?: () => Promise<{ ok: boolean }>
        onJournalsPathChanged?: (cb: () => void) => () => void
        getExternalSummariesInfo?: (options?: { includeFileCounts?: boolean }) => Promise<{
          path: string | null
          defaultPath: string
          summaryFileCount: number
          summaryFileCounts?: {
            weekly: number
            monthly: number
            quarterly: number
            yearly: number
          }
          pathAvailableOnDevice?: boolean
        }>
        pickExternalSummariesDirectory?: () => Promise<string | null>
        setExternalSummariesDirectory?: (targetPath: string) => Promise<{
          ok: boolean
          summaryFileCount?: number
          summaryFileCounts?: {
            weekly: number
            monthly: number
            quarterly: number
            yearly: number
          }
        }>
        clearExternalSummariesDirectory?: () => Promise<{ ok: boolean }>
        onSummariesPathChanged?: (cb: () => void) => () => void
      }
    | undefined
}

export function mapValidationError(t: TFunction, code: string): string {
  switch (code) {
    case 'SAME_PATH':
      return t('storage.migrate_same_path', '目标目录与当前数据根目录相同')
    case 'INSIDE_SOURCE':
      return t('storage.migrate_inside_source', '不能选择当前数据目录内的子文件夹')
    case 'NOT_WRITABLE':
      return t('storage.directory_not_writable', '无法写入所选目录，请检查权限或更换路径')
    default:
      return t('storage.service_unavailable', '路径服务未就绪')
  }
}
