import { ModelPricingService } from '@baishou/ai'
import { logger } from '@baishou/shared'

export interface MobilePricingStatus {
  lastUpdated: string | null
  hasPrices: boolean
  loadFailed: boolean
}

/**
 * Thin wrapper around @baishou/ai ModelPricingService for mobile boot/settings.
 */
export class MobilePricingService {
  private readonly pricing = ModelPricingService.getInstance()

  async ensureLoaded(): Promise<void> {
    try {
      await this.pricing.ensureLoaded()
    } catch (e) {
      logger.warn('[MobilePricing] ensureLoaded failed:', e as Error)
    }
  }

  async getStatus(): Promise<MobilePricingStatus> {
    await this.ensureLoaded()
    return {
      lastUpdated: this.pricing.lastFetchTime?.toISOString() ?? null,
      hasPrices: this.pricing.hasCachedPrices,
      loadFailed: this.pricing.lastFetchFailed
    }
  }

  async refresh(): Promise<MobilePricingStatus & { success: boolean }> {
    try {
      await this.pricing.forceRefresh()
      const status = await this.getStatus()
      return {
        ...status,
        success: !this.pricing.lastFetchFailed
      }
    } catch (e: any) {
      logger.error('[MobilePricing] refresh failed:', e)
      return {
        lastUpdated: null,
        hasPrices: false,
        loadFailed: true,
        success: false
      }
    }
  }
}

export const mobilePricingService = new MobilePricingService()
