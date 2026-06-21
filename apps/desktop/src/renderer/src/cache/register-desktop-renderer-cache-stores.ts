import { globalCacheRegistry } from '@baishou/shared/cache'
import { clearChatAttachmentImageCaches } from '@baishou/ui/chat-attachment-thumbnail'
import { registerSummaryDashboardCacheStore } from '../lib/summary-dashboard-cache'

let desktopRendererStoresRegistered = false

export function registerDesktopRendererCacheStores(): void {
  if (desktopRendererStoresRegistered) return
  desktopRendererStoresRegistered = true

  registerSummaryDashboardCacheStore()
  globalCacheRegistry.register('chat.attachment', {
    invalidate: () => clearChatAttachmentImageCaches(),
    clear: () => clearChatAttachmentImageCaches()
  })

  globalCacheRegistry.register('attachment.thumb', {
    invalidate: () => clearChatAttachmentImageCaches(),
    clear: () => clearChatAttachmentImageCaches()
  })

  globalCacheRegistry.register('attachment.preview', {
    invalidate: () => clearChatAttachmentImageCaches(),
    clear: () => clearChatAttachmentImageCaches()
  })
}
