import type { AIProviderConfig, GlobalModelsConfig } from '../types/settings.types'
import { resolveProviderBaseUrl } from '../constants/provider-base-urls'
import {
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  resolveProviderListDialogueFallback
} from './agent-dialogue-model.util'

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
  fallbackModelId?: string
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

  const dialoguePair = resolveConfiguredPair(
    providers,
    models.globalDialogueProviderId,
    models.globalDialogueModelId
  )
  if (dialoguePair) {
    return {
      ok: true,
      providerConfig: dialoguePair.provider,
      modelId: dialoguePair.modelId,
      isFallback: true
    }
  }

  const listFallback = resolveProviderListDialogueFallback(providers)
  const providerListPair = resolveConfiguredPair(
    providers,
    listFallback.providerId,
    listFallback.modelId
  )
  if (providerListPair) {
    return {
      ok: true,
      providerConfig: providerListPair.provider,
      modelId: providerListPair.modelId,
      isFallback: true
    }
  }

  if (isConfiguredDialogueModelId(fallbackModelId)) {
    const operational = providers.find((p) => isProviderOperational(p))
    if (operational) {
      const mid = fallbackModelId!.trim()
      if (isModelAllowedOnProvider(operational, mid)) {
        return {
          ok: true,
          providerConfig: operational,
          modelId: mid,
          isFallback: true
        }
      }
    }
  }

  const staleSummaryProvider = providers.find(
    (p) => p.id === models.globalSummaryProviderId?.trim()
  )
  const staleDialogueProvider = providers.find(
    (p) => p.id === models.globalDialogueProviderId?.trim()
  )
  const namedProvider = staleSummaryProvider ?? staleDialogueProvider

  if (namedProvider && !readProviderApiKey(namedProvider)) {
    return { ok: false, reason: 'no_api_key', providerName: namedProvider.name }
  }

  if (providers.some((p) => p.isEnabled !== false && !readProviderApiKey(p))) {
    const missingKey = providers.find((p) => p.isEnabled !== false && !readProviderApiKey(p))
    if (missingKey && providers.every((p) => !readProviderApiKey(p))) {
      return { ok: false, reason: 'no_api_key', providerName: missingKey.name }
    }
  }

  return {
    ok: false,
    reason: 'no_model',
    providerName: namedProvider?.name
  }
}
