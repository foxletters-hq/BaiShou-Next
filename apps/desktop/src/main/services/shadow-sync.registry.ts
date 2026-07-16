import { BrowserWindow } from 'electron'
import { ShadowIndexSyncService } from '@baishou/core-desktop'
import { fileSystem, getActiveVaultShadowRepo, pathService, vaultService } from '../ipc/vault.ipc'
import { embeddingCallback } from '../ipc/diary-embedding.callback'

let cachedShadowSync: ShadowIndexSyncService | null = null
let cachedVaultName: string | null = null

function wireScanProgressBroadcast(shadowScout: ShadowIndexSyncService): void {
  shadowScout.onScanProgress((progress) => {
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('diary:sync-event', {
        type: 'indexing-progress',
        indexed: progress.indexed,
        total: progress.total
      })
    })
  })
}

/** 全局单例，保证扫描状态与 watcher 共用同一实例 */
export function getSharedShadowSync(): ShadowIndexSyncService {
  const activeVault = vaultService.getActiveVault()
  const vaultName = activeVault?.name ?? ''
  if (!cachedShadowSync || cachedVaultName !== vaultName) {
    const shadowRepo = getActiveVaultShadowRepo()
    cachedShadowSync = new ShadowIndexSyncService(
      shadowRepo,
      pathService,
      vaultService,
      fileSystem,
      embeddingCallback
    )
    wireScanProgressBroadcast(cachedShadowSync)
    cachedVaultName = vaultName
    // Diary isChanged → pending-reextract only (no auto LLM extract)
    void import('./raw-data-source.runtime').then(
      ({ ensureRawDataRuntime, rebindPendingReextractCollaborators, getDerivedFreshness }) => {
        ensureRawDataRuntime()
        rebindPendingReextractCollaborators()
        const freshness = getDerivedFreshness()
        cachedShadowSync?.setPendingReextractHook((filePath, contentHash) => {
          freshness.markPendingReextract(filePath, contentHash)
        })
      }
    )
  }
  return cachedShadowSync
}

export function resetSharedShadowSync(): void {
  cachedShadowSync = null
  cachedVaultName = null
}
