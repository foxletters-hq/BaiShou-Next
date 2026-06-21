import { applyCacheInvalidation, globalCacheRegistry } from '@baishou/shared/cache'
import type { DomainMutationEvent } from '@baishou/shared/cache'
import { registerDesktopRendererCacheStores } from './register-desktop-renderer-cache-stores'

/** Desktop Renderer 缓存协调器（由主进程 IPC 转发领域变更事件） */
export function initDesktopRendererCacheCoordinator(): () => void {
  registerDesktopRendererCacheStores()
  return () => {}
}

export function handleRendererDomainMutation(event: DomainMutationEvent): void {
  registerDesktopRendererCacheStores()
  applyCacheInvalidation(event, globalCacheRegistry)
}
