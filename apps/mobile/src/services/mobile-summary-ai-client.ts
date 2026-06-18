import { generateText } from 'ai'
import type { SummaryAiClient } from '@baishou/core-mobile'
import { SUMMARY_AI_GENERATION_TIMEOUT_MS } from '@baishou/core-mobile'
import { AIProviderRegistry } from '@baishou/ai'
import { logger, prepareProviderConfigForRuntime } from '@baishou/shared'
import type { SettingsManagerService } from '@baishou/core-mobile'
import { resolveSummaryConfig } from './mobile-summary-config.util'

export function buildMobileSummaryAiClient(
  settingsManager: SettingsManagerService
): SummaryAiClient {
  return {
    async generateContent(prompt: string, modelId: string): Promise<string> {
      const resolution = await resolveSummaryConfig(settingsManager, modelId)

      if (!resolution.ok) {
        if (resolution.reason === 'no_api_key') {
          throw new Error(
            `No active provider with API key for summary generation (provider: ${
              resolution.providerName ?? 'unknown'
            })`
          )
        }
        if (resolution.reason === 'no_model') {
          throw new Error('No summary model configured')
        }
        throw new Error('No active AI provider configured for summary generation')
      }

      const { providerConfig, modelId: finalModelId } = resolution
      const registry = AIProviderRegistry.getInstance()
      registry.initializeDefaultProviders()
      const provider = registry.getOrUpdateProvider(prepareProviderConfigForRuntime(providerConfig))
      const model = provider.getLanguageModel(finalModelId)

      const abortController = new AbortController()
      const timeoutId = setTimeout(() => abortController.abort(), SUMMARY_AI_GENERATION_TIMEOUT_MS)

      try {
        const { text } = await generateText({
          model,
          prompt,
          maxSteps: 1,
          abortSignal: abortController.signal
        } as any)
        return text
      } catch (e) {
        logger.error('[MobileSummaryAI] generateText failed:', e as Error)
        throw e
      } finally {
        clearTimeout(timeoutId)
      }
    }
  }
}
