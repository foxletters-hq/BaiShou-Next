import { domainMutationBus, emitDomainMutation } from '@baishou/core-mobile'
import { applyCacheInvalidation, globalCacheRegistry } from '@baishou/shared/cache'
import type { DomainMutationEvent, MutationAction } from '@baishou/shared/cache'
import { registerMobileCacheStores } from './register-mobile-cache-stores'

/**
 * Mobile 端缓存协调器：订阅 Core DomainMutationBus，按 shared 规则表失效各 CacheStore。
 */
export function initMobileCacheCoordinator(): () => void {
  registerMobileCacheStores()
  return domainMutationBus.subscribe((event) => {
    applyCacheInvalidation(event, globalCacheRegistry)
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

export function handleExternalDomainMutation(event: DomainMutationEvent): void {
  applyCacheInvalidation(event, globalCacheRegistry)
}
