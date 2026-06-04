import type { AIProviderConfig, GlobalModelsConfig } from '@baishou/shared'
import type { SettingsManagerService } from '@baishou/core-mobile'

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

export async function resolveSummaryConfig(
  settingsManager: SettingsManagerService,
  fallbackModelId?: string
): Promise<SummaryConfigResolution> {
  const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
  const globalModels =
    (await settingsManager.get<Partial<GlobalModelsConfig>>('global_models')) ?? {}

  const summaryProviderId =
    globalModels.globalSummaryProviderId?.trim() || globalModels.globalDialogueProviderId?.trim()

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
    globalModels.globalSummaryModelId?.trim() || fallbackModelId?.trim() || 'deepseek-chat'

  if (!modelId) {
    return { ok: false, reason: 'no_model', providerName: providerConfig.name }
  }

  return { ok: true, providerConfig, modelId, isFallback }
}

export async function isSummaryModelConfigured(
  settingsManager: SettingsManagerService
): Promise<boolean> {
  const result = await resolveSummaryConfig(settingsManager)
  return result.ok
}
