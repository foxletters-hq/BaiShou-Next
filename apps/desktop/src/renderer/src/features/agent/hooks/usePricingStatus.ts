import { useCallback, useEffect, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { toast } from '@baishou/ui'

/**
 * 计费价格表的加载时间与手动刷新。
 * 启动时取一次状态；价格表缺失时只提示一次，避免重复 toast。
 */
export function usePricingStatus(t: TFunction) {
  const [pricingLastUpdated, setPricingLastUpdated] = useState<Date | null>(null)
  const pricingBootWarnShownRef = useRef(false)

  const fetchPricingLastUpdated = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electron) return
    try {
      const status = await window.electron.ipcRenderer.invoke('pricing:get-status')
      if (status?.lastUpdated) {
        setPricingLastUpdated(new Date(status.lastUpdated))
      }

      const pricingUnavailable =
        status?.loadFailed || status?.hasPrices === false || !status?.lastUpdated
      if (pricingUnavailable && !pricingBootWarnShownRef.current) {
        pricingBootWarnShownRef.current = true
        toast.showWarning(
          t(
            'agent.chat.pricing_boot_load_failed',
            '未能拉取 models.dev 价格表，计费估算可能不准确，请检查网络后在计费面板中刷新'
          )
        )
      }
    } catch (e) {
      console.error('Failed to get pricing status:', e)
      if (!pricingBootWarnShownRef.current) {
        pricingBootWarnShownRef.current = true
        toast.showWarning(
          t(
            'agent.chat.pricing_boot_load_failed',
            '未能拉取 models.dev 价格表，计费估算可能不准确，请检查网络后在计费面板中刷新'
          )
        )
      }
    }
  }, [t])

  const handleRefreshPricing = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electron) {
      return { success: false, error: 'No electron context' }
    }
    try {
      const result = await window.electron.ipcRenderer.invoke('pricing:refresh')
      if (result.success && result.lastUpdated) {
        setPricingLastUpdated(new Date(result.lastUpdated))
        toast.showSuccess(t('agent.chat.pricing_refreshed', '价格表已更新'))
      } else if (!result.success || result.loadFailed || !result.hasPrices) {
        const errMsg = result.error || t('agent.chat.pricing_refresh_failed', '请检查网络环境')
        toast.showError(errMsg)
        return { ...result, success: false, error: errMsg }
      }
      return result
    } catch (e) {
      const errMsg =
        e instanceof Error ? e.message : t('agent.chat.pricing_refresh_failed', '请检查网络环境')
      console.error('Failed to refresh pricing:', e)
      toast.showError(errMsg)
      return { success: false, error: errMsg }
    }
  }, [t])

  useEffect(() => {
    fetchPricingLastUpdated()
  }, [fetchPricingLastUpdated])

  return { pricingLastUpdated, handleRefreshPricing }
}
