import type { AIProviderConfig, GlobalModelsConfig } from '@baishou/shared'
import { resolveSummaryConfigFromSettings, type SummaryConfigResolution } from '@baishou/shared'

export type { SummaryConfigResolution }

export async function resolveDesktopSummaryConfig(): Promise<SummaryConfigResolution> {
  const settings = (window as any).api?.settings
  if (!settings?.getProviders || !settings?.getGlobalModels) {
    return { ok: false, reason: 'no_active_provider' }
  }

  const [providers, globalModels] = await Promise.all([
    settings.getProviders() as Promise<AIProviderConfig[]>,
    settings.getGlobalModels() as Promise<Partial<GlobalModelsConfig> | null>
  ])

  return resolveSummaryConfigFromSettings(providers ?? [], globalModels ?? {})
}
