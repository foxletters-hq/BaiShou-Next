import type { TFunction } from 'i18next'
import { isDiskFullError } from '@baishou/shared'

export function friendlySyncError(msg: string, t: TFunction): string {
  if (!msg) return t('data_sync.sync_failed_generic', 'Sync failed')
  let cleanMsg = msg.replace(/^Error:\s*/i, '')
  cleanMsg = cleanMsg.replace(/^Error invoking remote method '.*?':\s*/i, '')

  if (cleanMsg.includes('SyncInProgressError') || cleanMsg.includes('already in progress')) {
    return t('data_sync.error_in_progress', 'Sync is already in progress. Please wait.')
  }
  if (cleanMsg.includes('not initialized') || cleanMsg.includes('Please update config first')) {
    return t(
      'data_sync.error_not_initialized',
      'Sync service is not initialized. Please save your connection settings first.'
    )
  }
  if (cleanMsg.includes('S3NotConfiguredError')) {
    return t(
      'data_sync.error_not_configured',
      'Sync is not enabled or configuration is incomplete.'
    )
  }
  if (cleanMsg.includes('InvalidAccessKeyId')) {
    return t(
      'data_sync.error_invalid_access_key',
      'Access Key is invalid or expired. Please update your credentials.'
    )
  }
  if (
    cleanMsg.includes('SignatureDoesNotMatch') ||
    (cleanMsg.includes('signature') && cleanMsg.includes('does not match'))
  ) {
    return t(
      'data_sync.error_invalid_secret',
      'Secret Key is invalid. Please update your credentials.'
    )
  }
  if (cleanMsg.includes('AccessDenied')) {
    return t(
      'data_sync.error_access_denied',
      'Access denied. Please check bucket permissions or credentials.'
    )
  }
  if (cleanMsg.includes('NoSuchBucket')) {
    return t('data_sync.error_no_bucket', 'Bucket does not exist. Please check the bucket name.')
  }
  if (cleanMsg.includes('ENOTFOUND') || cleanMsg.includes('getaddrinfo')) {
    return t(
      'data_sync.error_dns',
      'Unable to resolve hostname. Please check the endpoint and network.'
    )
  }
  if (cleanMsg.includes('ECONNREFUSED')) {
    return t(
      'data_sync.error_conn_refused',
      'Connection refused. Please check the endpoint and service status.'
    )
  }
  if (isDiskFullError(cleanMsg)) {
    return t(
      'data_sync.error_disk_full',
      '磁盘空间不足，请清理空间后重试。Git 同步与数据导出都需要足够的可用磁盘空间。'
    )
  }
  if (cleanMsg.includes('SyncDivergenceExceededError')) {
    const match = cleanMsg.match(/divergence (\d+)% exceeds limit (\d+)%/)
    if (match) {
      return t('data_sync.error_divergence_exceeded', {
        divergence: match[1],
        limit: match[2]
      })
    }
    return t('data_sync.error_divergence_exceeded_generic')
  }
  if (cleanMsg.includes('SyncDeletePropagationBlockedError')) {
    if (cleanMsg.includes('local_data_loss')) {
      return t('data_sync.error_delete_propagation_local_data_loss')
    }
    return t('data_sync.error_delete_propagation_mass_delete')
  }
  return t('data_sync.error_sync_failed_with_msg', 'Sync failed: {{msg}}', { msg: cleanMsg })
}
