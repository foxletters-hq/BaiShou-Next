import type { AIProviderConfig, GlobalModelsConfig } from '../types/settings.types'

export type SummaryConfigResolution =
  | {
      ok: true
      providerConfig: AIProviderConfig
      modelId: string
      isFallback: boolean
    }
  | {
      ok: false
      reason: 'no_active_provider' | 'no_api_key' | 'no_model'
      providerName?: string
    }

export function resolveSummaryConfigFromSettings(
  providers: AIProviderConfig[],
  globalModels: Partial<GlobalModelsConfig> | null | undefined,
  fallbackModelId?: string
): SummaryConfigResolution {
  const models = globalModels ?? {}

  const summaryProviderId =
    models.globalSummaryProviderId?.trim() || models.globalDialogueProviderId?.trim()

  let providerConfig: AIProviderConfig | undefined
  let isFallback = false

  if (summaryProviderId) {
    providerConfig = providers.find((p) => p.id === summaryProviderId && p.isEnabled)
  }

  if (!providerConfig) {
    providerConfig = providers.find((p) => p.isEnabled)
    isFallback = true
  }

  if (!providerConfig) {
    return { ok: false, reason: 'no_active_provider' }
  }

  if (!providerConfig.apiKey || !providerConfig.apiKey.trim()) {
    return { ok: false, reason: 'no_api_key', providerName: providerConfig.name }
  }

  const modelId =
    models.globalSummaryModelId?.trim() || fallbackModelId?.trim() || 'deepseek-chat'

  if (!modelId) {
    return { ok: false, reason: 'no_model', providerName: providerConfig.name }
  }

  return { ok: true, providerConfig, modelId, isFallback }
}
