import { generateText } from 'ai'
import type { SummaryAiClient } from '@baishou/core-mobile'
import { AIProviderRegistry } from '@baishou/ai'
import type { AIProviderConfig, GlobalModelsConfig } from '@baishou/shared'
import { logger } from '@baishou/shared'
import type { SettingsManagerService } from '@baishou/core-mobile'

export function buildMobileSummaryAiClient(
  settingsManager: SettingsManagerService
): SummaryAiClient {
  return {
    async generateContent(prompt: string, modelId: string): Promise<string> {
      const providers =
        (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
      const globalModels: GlobalModelsConfig =
        (await settingsManager.get<GlobalModelsConfig>('global_models')) ?? {}

      const summaryProviderId =
        globalModels.globalSummaryProviderId || globalModels.globalDialogueProviderId
      const config =
        providers.find((p) => p.id === summaryProviderId) ||
        providers.find((p) => p.isEnabled)

      if (!config) {
        throw new Error('No active AI provider configured for summary generation')
      }

      const registry = AIProviderRegistry.getInstance()
      registry.initializeDefaultProviders()
      const provider = registry.getOrUpdateProvider(config)
      const finalModelId =
        globalModels.globalSummaryModelId || modelId || config.defaultDialogueModel || 'deepseek-chat'
      const model = provider.getLanguageModel(finalModelId)

      const abortController = new AbortController()
      const timeoutId = setTimeout(() => abortController.abort(), 45_000)

      try {
        const { text } = await generateText({
          model,
          prompt,
          maxSteps: 1,
          abortSignal: abortController.signal
        } as any)
        return text
      } catch (e) {
        logger.error('[MobileSummaryAI] generateText failed:', e)
        throw e
      } finally {
        clearTimeout(timeoutId)
      }
    }
  }
}
