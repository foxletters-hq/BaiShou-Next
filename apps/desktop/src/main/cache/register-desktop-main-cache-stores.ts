import { globalCacheRegistry } from '@baishou/shared/cache'
import { invalidateMcpToolContextCache } from '../ipc/agent-helpers'
import { resetCachedManager } from '../ipc/summary.ipc'
import { resetAttachmentAllowedRootsCache } from '../ipc/attachment-path-cache'

let desktopMainStoresRegistered = false

export function registerDesktopMainCacheStores(): void {
  if (desktopMainStoresRegistered) return
  desktopMainStoresRegistered = true

  globalCacheRegistry.register('mcp.toolContext', {
    invalidate: () => invalidateMcpToolContextCache(),
    clear: () => invalidateMcpToolContextCache()
  })

  // summary.gallery / summary.dashboard 的 SWR 在 Renderer；Main 仅在 vault 切换 clearAll 时重建 Manager
  globalCacheRegistry.register('summary.gallery', {
    invalidate: () => {},
    clear: () => resetCachedManager()
  })

  globalCacheRegistry.register('attachment.thumb', {
    invalidate: () => resetAttachmentAllowedRootsCache(),
    clear: () => resetAttachmentAllowedRootsCache()
  })

  globalCacheRegistry.register('attachment.preview', {
    invalidate: () => resetAttachmentAllowedRootsCache(),
    clear: () => resetAttachmentAllowedRootsCache()
  })
}
