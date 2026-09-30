import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  getReasoningCatalogEpoch,
  listSessionReasoningEffortSettings,
  resolveReasoningEffortForSlot,
  subscribeReasoningCatalog,
  type GlobalModelsConfig,
  type ReasoningEffortSetting
} from '@baishou/shared'
import {
  loadMobileSessionReasoningEffort,
  saveMobileSessionReasoningEffort
} from '@/src/services/mobile-reasoning-effort-session'
import { useBaishou } from '@/src/providers/BaishouProvider'

export function useSessionReasoningEffort({
  sessionId,
  providerId,
  providerType,
  modelId
}: {
  sessionId: string | null
  providerId: string | null
  providerType?: string | null
  modelId: string | null
}) {
  const { services, dbReady } = useBaishou()
  const epoch = useSyncExternalStore(
    subscribeReasoningCatalog,
    getReasoningCatalogEpoch,
    getReasoningCatalogEpoch
  )
  const [value, setValue] = useState<ReasoningEffortSetting>('auto')

  const options = useMemo(() => {
    void epoch
    return listSessionReasoningEffortSettings(
      modelId || '',
      providerType || providerId || undefined
    )
  }, [epoch, modelId, providerId, providerType])
  const optionKey = options.join('|')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let fallback: ReasoningEffortSetting = 'auto'
      if (dbReady && services) {
        const models = await services.settingsManager.get<GlobalModelsConfig>('global_models')
        fallback = resolveReasoningEffortForSlot(models?.reasoningEffortBySlot, 'dialogue')
      }
      const next = await loadMobileSessionReasoningEffort(sessionId, providerId, modelId, fallback)
      if (cancelled) return
      setValue(options.includes(next) ? next : 'auto')
    })()
    return () => {
      cancelled = true
    }
  }, [dbReady, modelId, optionKey, options, providerId, services, sessionId])

  const selected = options.includes(value) ? value : 'auto'

  return {
    value: selected,
    options,
    onChange: (next: ReasoningEffortSetting) => {
      const nextValue = options.includes(next) ? next : 'auto'
      setValue(nextValue)
      void saveMobileSessionReasoningEffort(sessionId, providerId, modelId, nextValue)
    }
  }
}
