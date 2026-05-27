import { ipcMain } from 'electron'
import { logger } from '@baishou/shared'
import { ModelPricingService } from '@baishou/ai'

export function registerPricingIPC() {
  // ==========================================
  // API: 获取价格表最后更新时间
  // ==========================================
  ipcMain.handle('pricing:get-last-updated', async () => {
    const pricingService = ModelPricingService.getInstance()
    return pricingService.lastFetchTime?.toISOString() || null
  })

  // ==========================================
  // API: 获取价格表加载状态（含启动拉取结果）
  // ==========================================
  ipcMain.handle('pricing:get-status', async () => {
    const pricingService = ModelPricingService.getInstance()
    try {
      await pricingService.ensureLoaded()
    } catch (err) {
      logger.warn('[ModelPricingService] ensureLoaded failed in pricing:get-status:', err)
    }

    return {
      lastUpdated: pricingService.lastFetchTime?.toISOString() || null,
      hasPrices: pricingService.hasCachedPrices,
      loadFailed: pricingService.lastFetchFailed
    }
  })

  // ==========================================
  // API: 强制刷新计费价格表
  // ==========================================
  ipcMain.handle('pricing:refresh', async () => {
    try {
      const pricingService = ModelPricingService.getInstance()
      await pricingService.forceRefresh()
      return {
        success: !pricingService.lastFetchFailed,
        lastUpdated: pricingService.lastFetchTime?.toISOString() || null,
        loadFailed: pricingService.lastFetchFailed,
        hasPrices: pricingService.hasCachedPrices
      }
    } catch (e: any) {
      logger.error('Failed to refresh pricing:', e)
      return { success: false, error: e.message, loadFailed: true, hasPrices: false }
    }
  })

  // 软件启动时，自动尝试异步拉取最新的计费信息，确保首屏加载或点开计费面板时有最新价格和有效更新时间
  ModelPricingService.getInstance()
    .ensureLoaded()
    .catch((err) => {
      logger.warn('[ModelPricingService] Failed to auto-fetch pricing on boot:', err)
    })
}
