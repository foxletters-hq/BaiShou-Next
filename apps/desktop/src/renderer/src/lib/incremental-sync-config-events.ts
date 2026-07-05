export const INCREMENTAL_SYNC_CONFIG_CHANGED_EVENT = 'baishou:incremental-sync-config-changed'

export function notifyIncrementalSyncConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(INCREMENTAL_SYNC_CONFIG_CHANGED_EVENT))
}
