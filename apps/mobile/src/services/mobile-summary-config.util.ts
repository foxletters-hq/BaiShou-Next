import type { AIProviderConfig, GlobalModelsConfig } from '@baishou/shared'
import type { SettingsManagerService } from '@baishou/core-mobile'
import { resolveSummaryConfigFromSettings, type SummaryConfigResolution } from '@baishou/shared'

export type { SummaryConfigResolution }

export async function resolveSummaryConfig(
  settingsManager: SettingsManagerService,
  fallbackModelId?: string
): Promise<SummaryConfigResolution> {
  const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
  const globalModels =
    (await settingsManager.get<Partial<GlobalModelsConfig>>('global_models')) ?? {}

  return resolveSummaryConfigFromSettings(providers, globalModels, fallbackModelId)
}

export async function isSummaryModelConfigured(
  settingsManager: SettingsManagerService
): Promise<boolean> {
  const result = await resolveSummaryConfig(settingsManager)
  return result.ok
}
