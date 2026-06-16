import type { TFunction } from 'i18next'

export function friendlyMobileSyncError(msg: string, t: TFunction): string {
  if (!msg) return t('data_sync.sync_failed_generic')

  const cleanMsg = msg.replace(/^Error:\s*/i, '')

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

  return t('data_sync.error_sync_failed_with_msg', { msg: cleanMsg })
}
