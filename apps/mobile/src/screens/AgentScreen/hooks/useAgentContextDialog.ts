import { useCallback, useEffect, useState } from 'react'
import { useContextCompressionStore } from '@baishou/store'
import type { useBaishou } from '../../../providers/BaishouProvider'
import type { useAgentStream } from '../../../hooks/useAgentStream'
import type { useNativeToast } from '@baishou/ui/native'

type Baishou = ReturnType<typeof useBaishou>
type Stream = ReturnType<typeof useAgentStream>
type Toast = ReturnType<typeof useNativeToast>

export function useAgentContextDialog(deps: {
  currentSessionId: string | null
  services: Baishou['services']
  searchMode: boolean
  toast: Toast
  t: (key: string, fallback?: string) => string
  isCompressing: Stream['isCompressing']
  compressionPhase: Stream['compressionPhase']
  compressionText: Stream['compressionText']
  compressionReasoning: Stream['compressionReasoning']
  tokenUsage: Stream['tokenUsage']
  showCostDialog: boolean
  dbReady: boolean
}) {
  const {
    currentSessionId,
    services,
    searchMode,
    toast,
    t,
    isCompressing,
    compressionPhase,
    compressionText,
    compressionReasoning,
    tokenUsage,
    showCostDialog,
    dbReady
  } = deps

  const [contextDialogState, setContextDialogState] = useState<{
    visible: boolean
    sessionId?: string
    message: any
    flatEntries: any[]
    meta?: any
    compressedContent?: string
    systemPrompt?: string
  }>({
    visible: false,
    message: {},
    flatEntries: []
  })

  const activeContextSessionId = contextDialogState.sessionId ?? currentSessionId ?? undefined
  const contextRecompressJob = useContextCompressionStore((s) =>
    activeContextSessionId ? s.jobs[activeContextSessionId] : undefined
  )
  const storeRunRecompress = useContextCompressionStore((s) => s.runRecompress)
  const storeClearRecompressError = useContextCompressionStore((s) => s.clearError)

  const runContextRecompress = useCallback(
    async (targetSessionId: string) => {
      if (!targetSessionId) return
      const result = await storeRunRecompress(targetSessionId)
      if (result?.ok && result.summaryText) {
        setContextDialogState((prev) => ({
          ...prev,
          compressedContent: result.summaryText,
          flatEntries: prev.flatEntries?.map((entry: { kind?: string; summaryText?: string }) =>
            entry.kind === 'compression-summary'
              ? { ...entry, summaryText: result.summaryText }
              : entry
          )
        }))
      }
    },
    [storeRunRecompress]
  )

  const dismissContextRecompressError = useCallback(() => {
    if (activeContextSessionId) storeClearRecompressError(activeContextSessionId)
  }, [activeContextSessionId, storeClearRecompressError])

  useEffect(() => {
    if (!contextDialogState.visible || !isCompressing || compressionPhase !== 'manual') return
    if (!compressionText.trim() && !compressionReasoning.trim()) return
    setContextDialogState((prev) => ({
      ...prev,
      compressedContent: compressionText || prev.compressedContent,
      flatEntries: prev.flatEntries?.map((entry: { kind?: string; summaryText?: string }) =>
        entry.kind === 'compression-summary' && compressionText
          ? { ...entry, summaryText: compressionText }
          : entry
      )
    }))
  }, [
    contextDialogState.visible,
    isCompressing,
    compressionPhase,
    compressionText,
    compressionReasoning
  ])

  const handleShowContext = useCallback(
    async (message: any) => {
      if (!currentSessionId || !services?.getContextAtMessage) return
      try {
        const { result, flatEntries } = await services.getContextAtMessage(
          currentSessionId,
          message.id,
          searchMode
        )
        const vm = result.viewModel
        setContextDialogState({
          visible: true,
          sessionId: currentSessionId ?? undefined,
          message: {
            ...message,
            inputTokens: message.inputTokens,
            outputTokens: message.outputTokens,
            cacheReadInputTokens: message.cacheReadInputTokens,
            cacheWriteInputTokens: message.cacheWriteInputTokens,
            costMicros: message.costMicros
          },
          flatEntries,
          meta: {
            nextRequest: vm?.nextRequest,
            roundUsage: vm?.roundUsage,
            activeRoundIndex: vm?.activeRoundIndex
          },
          compressedContent: result.compressedContent,
          systemPrompt: result.systemPrompt
        })
      } catch (e) {
        console.error('[AgentScreen] Failed to load context at message:', e)
        toast.showError(t('agent.chat.context_load_failed', '加载调用链失败'))
      }
    },
    [currentSessionId, services, searchMode, toast, t]
  )

  const totalInputTokens = tokenUsage?.inputTokens || 0
  const totalOutputTokens = tokenUsage?.outputTokens || 0
  const totalCacheReadInputTokens = tokenUsage?.cacheReadInputTokens || 0
  const totalCacheWriteInputTokens = tokenUsage?.cacheWriteInputTokens || 0
  const estimatedCost = (tokenUsage?.totalCostMicros || 0) / 1_000_000
  const totalCostMicros = tokenUsage?.totalCostMicros || 0
  const [pricingLastUpdated, setPricingLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (!showCostDialog || !dbReady || !services?.pricingService) return
    void services.pricingService.getStatus().then((status) => {
      if (status.lastUpdated) {
        setPricingLastUpdated(new Date(status.lastUpdated))
      }
    })
  }, [showCostDialog, dbReady, services])

  const handleRefreshPricing = useCallback(async () => {
    if (!services?.pricingService) {
      return { success: false, error: t('agent.chat.pricing_refresh_failed', '刷新失败') }
    }
    try {
      const result = await services.pricingService.refresh()
      if (result.lastUpdated) {
        setPricingLastUpdated(new Date(result.lastUpdated))
      }
      if (result.success) {
        toast.showSuccess(t('agent.chat.pricing_refreshed', '价格表已更新'))
      }
      return {
        success: result.success,
        error: result.success ? undefined : t('agent.chat.pricing_refresh_failed', '刷新失败')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, error: msg }
    }
  }, [services, t, toast])
  return {
    contextDialogState,
    setContextDialogState,
    activeContextSessionId,
    contextRecompressJob,
    runContextRecompress,
    dismissContextRecompressError,
    handleShowContext,
    handleRefreshPricing,
    pricingLastUpdated,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadInputTokens,
    totalCacheWriteInputTokens,
    estimatedCost,
    totalCostMicros
  }
}
