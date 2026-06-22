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
      return t('data_sync.progress_upload', '上传：{{path}}', { path })
    case 'download':
      return t('data_sync.progress_download', '下载：{{path}}', { path })
    case 'delete':
      return t('data_sync.progress_delete', '删除：{{path}}', { path })
    case 'skip':
      return t('data_sync.progress_skip', '跳过：{{path}}', { path })
    default:
      return path
  }
}

export function formatSyncProgressPhaseLabel(
  event: Pick<SyncProgressEvent, 'phase' | 'statusText'>,
  t: SyncProgressTranslate
): string {
  if (event.statusText) {
    if (event.statusText.startsWith('data_sync.')) {
      return t(event.statusText, event.statusText)
    }
    return event.statusText
  }

  switch (event.phase) {
    case 'scanning':
      return t('data_sync.progress_scanning_local', '正在扫描本地文件…')
    case 'comparing':
      return t('data_sync.progress_fetching_remote', '正在获取远程清单…')
    case 'finalizing':
      return t('data_sync.progress_finalizing', '正在保存同步状态…')
    case 'syncing':
    default:
      return t('data_sync.syncing', '同步中…')
  }
}

export function formatSyncProgressSummary(
  event: SyncProgressEvent,
  t: SyncProgressTranslate
): { headline: string; detail: string } {
  const phaseLabel = formatSyncProgressPhaseLabel(event, t)
  const fileLine =
    event.action && event.fileName ? formatSyncProgressStatus(event, t) : ''

  if (event.phase === 'syncing' && event.total > 0) {
    return {
      headline: `${event.current}/${event.total}`,
      detail: fileLine || phaseLabel
    }
  }

  if (event.total > 0) {
    return {
      headline: `${event.current}/${event.total}`,
      detail: fileLine || phaseLabel
    }
  }

  return {
    headline: phaseLabel,
    detail: fileLine
  }
}
