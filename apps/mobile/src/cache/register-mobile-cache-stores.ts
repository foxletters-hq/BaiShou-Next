import { globalCacheRegistry, registerDiaryListCacheStore } from '@baishou/shared/cache'
import { clearGlobalTtsSynthesisCache, clearMimoRefAudioHydrationCache } from '@baishou/shared'
import { invalidateAllAvatarDisplayCaches } from '../lib/assistant-avatar-display.util'
import { invalidateUserAvatarDisplayCache } from '../lib/user-avatar-display.util'
import { registerSummaryDashboardCacheStore } from '../lib/summary-dashboard-cache'
import { clearAllAttachmentImageCaches } from '../utils/mobile-attachment-image-cache'
import { invalidateMobileMcpToolContextCache } from '../services/mobile-mcp-context.service'
import { clearProviderSettingsCache } from '../screens/SettingsScreen/utils/provider-settings'

let mobileStoresRegistered = false

/** 将移动端各缓存模块注册进 globalCacheRegistry */
export function registerMobileCacheStores(): void {
  if (mobileStoresRegistered) return
  mobileStoresRegistered = true

  registerSummaryDashboardCacheStore()
  registerDiaryListCacheStore()

  globalCacheRegistry.register('avatar.user', {
    invalidate: () => invalidateUserAvatarDisplayCache(),
    clear: () => invalidateUserAvatarDisplayCache()
  })

  globalCacheRegistry.register('avatar.assistant', {
    invalidate: () => invalidateAllAvatarDisplayCaches(),
    clear: () => invalidateAllAvatarDisplayCaches()
  })

  globalCacheRegistry.register('attachment.thumb', {
    invalidate: () => clearAllAttachmentImageCaches(),
    clear: () => clearAllAttachmentImageCaches()
  })

  globalCacheRegistry.register('attachment.preview', {
    invalidate: () => clearAllAttachmentImageCaches(),
    clear: () => clearAllAttachmentImageCaches()
  })

  globalCacheRegistry.register('mcp.toolContext', {
    invalidate: () => invalidateMobileMcpToolContextCache(),
    clear: () => invalidateMobileMcpToolContextCache()
  })

  globalCacheRegistry.register('tts.synthesis', {
    invalidate: () => {
      clearGlobalTtsSynthesisCache()
      clearMimoRefAudioHydrationCache()
    },
    clear: () => {
      clearGlobalTtsSynthesisCache()
      clearMimoRefAudioHydrationCache()
    }
  })

  globalCacheRegistry.register('settings.aiProviders', {
    invalidate: () => clearProviderSettingsCache(),
    clear: () => clearProviderSettingsCache()
  })
}
