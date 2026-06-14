import type { TFunction } from 'i18next'

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
  return t('data_sync.error_sync_failed_with_msg', 'Sync failed: {{msg}}', { msg: cleanMsg })
}
