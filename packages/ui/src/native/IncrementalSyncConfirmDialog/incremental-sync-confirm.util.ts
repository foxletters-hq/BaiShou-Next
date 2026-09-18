import type { IncrementalSyncPlanItem, IncrementalSyncVaultSummary } from '@baishou/shared'
import type { TextStyle } from 'react-native'

export function actionTagStyle(action: IncrementalSyncPlanItem['action']): TextStyle {
  switch (action) {
    case 'upload':
      return { backgroundColor: 'rgba(59, 130, 246, 0.14)' }
    case 'download':
      return { backgroundColor: 'rgba(16, 185, 129, 0.14)' }
    case 'delete-local':
    case 'delete-remote':
      return { backgroundColor: 'rgba(239, 68, 68, 0.14)' }
    case 'conflict-resolved':
      return { backgroundColor: 'rgba(245, 158, 11, 0.14)' }
    default:
      return { backgroundColor: 'rgba(59, 130, 246, 0.14)' }
  }
}

export function formatVaultStats(
  summary: IncrementalSyncVaultSummary,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const parts: string[] = []
  if (summary.upload > 0) parts.push(t('data_sync.plan_stat_upload', { count: summary.upload }))
  if (summary.download > 0) {
    parts.push(t('data_sync.plan_stat_download', { count: summary.download }))
  }
  if (summary.deleteLocal > 0) {
    parts.push(t('data_sync.plan_stat_delete_local', { count: summary.deleteLocal }))
  }
  if (summary.deleteRemote > 0) {
    parts.push(t('data_sync.plan_stat_delete_remote', { count: summary.deleteRemote }))
  }
  if (summary.conflict > 0) {
    parts.push(t('data_sync.plan_stat_conflict', { count: summary.conflict }))
  }
  return parts.join(' · ')
}

export function formatVaultLabel(
  vaultName: string,
  t: (key: string, options?: { defaultValue?: string }) => string
): string {
  if (vaultName === '__root__')
    return t('data_sync.plan_vault_root', { defaultValue: '根目录文件' })
  if (vaultName === '__unknown__')
    return t('data_sync.plan_vault_unknown', { defaultValue: '未知工作区' })
  return vaultName
}

export function collectOtherSyncWarnings(warnings: string[]): string[] {
  const boundaryKeys = new Set([
    'data_sync.plan_warning_unknown_vault_paths',
    'data_sync.plan_warning_disk_vaults_not_in_registry',
    'data_sync.plan_warning_registry_vaults_missing_on_disk'
  ])
  const skipKeys = new Set(['data_sync.plan_warning_delete_blocked'])
  return warnings.filter((key) => !boundaryKeys.has(key) && !skipKeys.has(key))
}
