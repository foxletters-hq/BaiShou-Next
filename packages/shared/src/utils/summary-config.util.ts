import type { AIProviderConfig, GlobalModelsConfig } from '../types/settings.types'
import { resolveProviderBaseUrl } from '../constants/provider-base-urls'
import { isConfiguredDialogueModelId, isConfiguredProviderId } from './agent-dialogue-model.util'

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

export function readProviderApiKey(config: AIProviderConfig): string {
  const raw = config as AIProviderConfig & { api_key?: string }
  return (config.apiKey || raw.api_key || '').trim()
}

export function prepareProviderConfigForRuntime(config: AIProviderConfig): AIProviderConfig {
  return {
    ...config,
    apiKey: readProviderApiKey(config),
    baseUrl: resolveProviderBaseUrl(config.id, config.type, config.baseUrl)
  }
}

function isProviderOperational(config: AIProviderConfig | undefined): config is AIProviderConfig {
  return !!config && config.isEnabled !== false && !!readProviderApiKey(config)
}

function isModelAllowedOnProvider(provider: AIProviderConfig, modelId: string): boolean {
  const enabled = provider.enabledModels
  if (!enabled?.length) return true
  return enabled.includes(modelId)
}

/** 供应商 + 模型是否可用于总结生成（启用、有 Key、在 enabledModels 内） */
export function canUseProviderModel(
  providers: AIProviderConfig[],
  providerId: string | null | undefined,
  modelId: string | null | undefined
): boolean {
  return resolveConfiguredPair(providers, providerId, modelId) != null
}

function resolveConfiguredPair(
  providers: AIProviderConfig[],
  providerId: string | null | undefined,
  modelId: string | null | undefined
): { provider: AIProviderConfig; modelId: string } | null {
  if (!isConfiguredProviderId(providerId) || !isConfiguredDialogueModelId(modelId)) {
    return null
  }

  const pid = providerId!.trim()
  const mid = modelId!.trim()
  const provider = providers.find((p) => p.id === pid)
  if (!isProviderOperational(provider)) return null
  if (!isModelAllowedOnProvider(provider, mid)) return null

  return { provider, modelId: mid }
}

export function resolveSummaryConfigFromSettings(
  providers: AIProviderConfig[],
  globalModels: Partial<GlobalModelsConfig> | null | undefined,
  _fallbackModelId?: string
): SummaryConfigResolution {
  const models = globalModels ?? {}

  const summaryPair = resolveConfiguredPair(
    providers,
    models.globalSummaryProviderId,
    models.globalSummaryModelId
  )
  if (summaryPair) {
    return {
      ok: true,
      providerConfig: summaryPair.provider,
      modelId: summaryPair.modelId,
      isFallback: false
    }
  }

  const staleSummaryProvider = providers.find(
    (p) => p.id === models.globalSummaryProviderId?.trim()
  )
  if (staleSummaryProvider && !readProviderApiKey(staleSummaryProvider)) {
    return { ok: false, reason: 'no_api_key', providerName: staleSummaryProvider.name }
  }

  return {
    ok: false,
    reason: 'no_model',
    providerName: staleSummaryProvider?.name
  }
}
