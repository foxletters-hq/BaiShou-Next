import type { SyncProgressEvent } from '@baishou/shared'

export type SyncProgressTranslate = (
  key: string,
  defaultValue: string,
  options?: Record<string, unknown>
) => string

/** Format sync progress line for UI (i18n-aware). */
export function formatSyncProgressStatus(
  event: Pick<SyncProgressEvent, 'action' | 'fileName'>,
  t: SyncProgressTranslate
): string {
  const path = event.fileName ?? ''
  if (!path) return ''

  switch (event.action) {
    case 'upload':
      return t('data_sync.progress_upload', 'Upload: {{path}}', { path })
    case 'download':
      return t('data_sync.progress_download', 'Download: {{path}}', { path })
    case 'delete':
      return t('data_sync.progress_delete', 'Delete: {{path}}', { path })
    case 'skip':
      return t('data_sync.progress_skip', 'Skip: {{path}}', { path })
    default:
      return path
  }
}
