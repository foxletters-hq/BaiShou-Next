import { settingsManager } from './settings.ipc'
import {
  GlobalModelsConfig,
  canUseProviderModel,
  logger,
  normalizeReasoningEffortSetting,
  prepareProviderConfigForRuntime,
  resolveSummaryConfigFromSettings,
  type AIProviderConfig
} from '@baishou/shared'
import type { SummaryAiClient, SummaryAiGenerateOptions } from '@baishou/core-desktop'
import {
  SUMMARY_AI_GENERATION_TIMEOUT_MS,
  generateSummaryTextFromModel,
  isSummaryFirstOutputTimeoutError
} from '@baishou/core/shared'
import { AIProviderRegistry, buildReasoningProviderOptions } from '@baishou/ai'

function resolveProviderById(
  providers: AIProviderConfig[],
  providerId: string,
  modelId: string
): AIProviderConfig | undefined {
  if (!canUseProviderModel(providers, providerId, modelId)) return undefined
  return providers.find((p) => p.id === providerId)
}

/**
 * 构建摘要 AI 生成客户端。
 * 支持自定义摘要模型覆盖全局默认 Provider；伙伴模式可传入 providerId + system。
 */
export function buildSummaryAiClient(): SummaryAiClient {
  return {
    async generateContent(
      prompt: string,
      modelId: string,
      options?: SummaryAiGenerateOptions
    ): Promise<string> {
      const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')

      let providerConfig: AIProviderConfig
      let finalModelId: string

      if (options?.providerId) {
        const override = resolveProviderById(providers, options.providerId, modelId)
        if (!override) {
          throw new Error(
            `No active provider with API key for summary generation (provider: ${options.providerId})`
          )
        }
        providerConfig = override
        finalModelId = modelId
      } else {
        const resolution = resolveSummaryConfigFromSettings(providers, globalModels, modelId)
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
      const finalProvider = registry.getOrUpdateProvider(
        prepareProviderConfigForRuntime(providerConfig)
      )
      const model = finalProvider.getLanguageModel(finalModelId)
      const providerUrl = finalProvider.config?.baseUrl || 'default'

      logger.info(
        `[SummaryAI] Starting generation request to model: ${finalModelId} (baseUrl: ${providerUrl}), prompt length: ${prompt.length}`
      )

      const startTime = Date.now()
      const abortController = new AbortController()
      const userSignal = options?.abortSignal

      const onUserAbort = () => abortController.abort()
      if (userSignal) {
        if (userSignal.aborted) {
          const err = new DOMException('The operation was aborted', 'AbortError')
          throw err
        }
        userSignal.addEventListener('abort', onUserAbort, { once: true })
      }

      const timeoutSeconds = SUMMARY_AI_GENERATION_TIMEOUT_MS / 1000

      try {
        logger.info(
          `[SummaryAI] Invoking streamText with ${timeoutSeconds}s first-output timeout...`
        )

        const providerOptions = options?.reasoningEffort
          ? buildReasoningProviderOptions({
              modelId: finalModelId,
              providerType: providerConfig.type || providerConfig.id,
              effort: normalizeReasoningEffortSetting(options.reasoningEffort)
            })
          : undefined
        const text = await generateSummaryTextFromModel({
          model,
          prompt,
          system: options?.system,
          abortController,
          firstOutputTimeoutMs: SUMMARY_AI_GENERATION_TIMEOUT_MS,
          providerOptions,
          onFirstOutput: () => {
            logger.info(
              `[SummaryAI] First model output received after ${Date.now() - startTime}ms; generation timeout cleared.`
            )
          },
          onTextDelta: options?.onTextDelta,
          onReasoningDelta: options?.onReasoningDelta
        })
        const duration = Date.now() - startTime

        logger.info(
          `[SummaryAI] streamText request succeeded in ${duration}ms. Response text length: ${text.length} characters.`
        )

        return text
      } catch (err: any) {
        const duration = Date.now() - startTime
        const userCancelled = Boolean(userSignal?.aborted)

        if (userCancelled) {
          logger.info(`[SummaryAI] Generation aborted by user after ${duration}ms.`)
        } else if (isSummaryFirstOutputTimeoutError(err)) {
          logger.error(
            `[SummaryAI] REQUEST TIMED OUT! AI generation request failed in ${duration}ms after exceeding the ${timeoutSeconds} seconds first-output limit.`
          )
        } else {
          logger.error(
            `[SummaryAI] streamText request failed in ${duration}ms. Error name: ${err.name}, message: ${err.message}`,
            err
          )
        }

        throw err
      } finally {
        userSignal?.removeEventListener('abort', onUserAbort)
      }
    }
  }
}
