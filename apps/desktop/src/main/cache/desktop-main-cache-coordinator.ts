import { BrowserWindow } from 'electron'
import { domainMutationBus, emitDomainMutation } from '@baishou/core-desktop'
import {
  applyCacheInvalidation,
  globalCacheRegistry,
  CACHE_DOMAIN_MUTATION_CHANNEL
} from '@baishou/shared/cache'
import type { DomainMutationEvent, MutationAction } from '@baishou/shared/cache'
import { registerDesktopMainCacheStores } from './register-desktop-main-cache-stores'

function broadcastCacheMutation(event: DomainMutationEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send(CACHE_DOMAIN_MUTATION_CHANNEL, event)
  }
}

/** Desktop 主进程缓存协调器 */
export function initDesktopMainCacheCoordinator(): () => void {
  registerDesktopMainCacheStores()
  return domainMutationBus.subscribe((event) => {
    applyCacheInvalidation(event, globalCacheRegistry)
    broadcastCacheMutation(event)
  })
}

export function emitVaultSwitchMutation(vaultKey?: string, reason = 'vault-switch'): void {
  emitDomainMutation({ domain: 'vault', action: 'switch', vaultKey, reason })
}

export function emitSyncMutation(
  action: Extract<MutationAction, 'complete' | 'resync-complete'>,
  reason: string
): void {
  emitDomainMutation({ domain: 'sync', action, reason })
}
