import { generateText } from 'ai'
import type { SummaryAiClient, SummaryAiGenerateOptions } from '@baishou/core-mobile'
import { SUMMARY_AI_GENERATION_TIMEOUT_MS } from '@baishou/core-mobile'
import { AIProviderRegistry } from '@baishou/ai'
import {
  logger,
  prepareProviderConfigForRuntime,
  canUseProviderModel,
  readProviderApiKey,
  type AIProviderConfig
} from '@baishou/shared'
import type { SettingsManagerService } from '@baishou/core-mobile'
import { resolveSummaryConfig } from './mobile-summary-config.util'

export function buildMobileSummaryAiClient(
  settingsManager: SettingsManagerService
): SummaryAiClient {
  return {
    async generateContent(
      prompt: string,
      modelId: string,
      options?: SummaryAiGenerateOptions
    ): Promise<string> {
      let providerConfig: AIProviderConfig
      let finalModelId: string

      if (options?.providerId) {
        const providers =
          (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
        const override = providers.find((p) => p.id === options.providerId)
        if (
          !override ||
          !canUseProviderModel(providers, options.providerId, modelId) ||
          !readProviderApiKey(override)
        ) {
          throw new Error(
            `No active provider with API key for summary generation (provider: ${options.providerId})`
          )
        }
        providerConfig = override
        finalModelId = modelId
      } else {
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
        providerConfig = resolution.providerConfig
        finalModelId = resolution.modelId
      }

      const registry = AIProviderRegistry.getInstance()
      registry.initializeDefaultProviders()
      const provider = registry.getOrUpdateProvider(prepareProviderConfigForRuntime(providerConfig))
      const model = provider.getLanguageModel(finalModelId)

      const abortController = new AbortController()
      const userSignal = options?.abortSignal
      const onUserAbort = () => abortController.abort()
      if (userSignal) {
        if (userSignal.aborted) {
          throw new DOMException('The operation was aborted', 'AbortError')
        }
        userSignal.addEventListener('abort', onUserAbort, { once: true })
      }
      const timeoutId = setTimeout(() => abortController.abort(), SUMMARY_AI_GENERATION_TIMEOUT_MS)

      try {
        const { text } = await generateText({
          model,
          ...(options?.system ? { system: options.system } : {}),
          prompt,
          maxSteps: 1,
          abortSignal: abortController.signal
        } as any)
        return text
      } catch (e) {
        if (userSignal?.aborted) {
          logger.info('[MobileSummaryAI] Generation aborted by user')
        } else {
          logger.error('[MobileSummaryAI] generateText failed:', e as Error)
        }
        throw e
      } finally {
        clearTimeout(timeoutId)
        userSignal?.removeEventListener('abort', onUserAbort)
      }
    }
  }
}
