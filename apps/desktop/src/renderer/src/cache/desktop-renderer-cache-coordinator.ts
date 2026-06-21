import { applyCacheInvalidation, globalCacheRegistry } from '@baishou/shared/cache'
import type { DomainMutationEvent } from '@baishou/shared/cache'
import { registerDesktopRendererCacheStores } from './register-desktop-renderer-cache-stores'

let rendererCoordinatorInitialized = false

/** Desktop Renderer 缓存协调器（由 App 订阅 IPC 并调用 handleRendererDomainMutation） */
export function initDesktopRendererCacheCoordinator(): void {
  if (rendererCoordinatorInitialized) return
  rendererCoordinatorInitialized = true
  registerDesktopRendererCacheStores()
}

export function handleRendererDomainMutation(event: DomainMutationEvent): void {
  initDesktopRendererCacheCoordinator()
  applyCacheInvalidation(event, globalCacheRegistry)
}
