import { generateText } from 'ai'
import i18n from 'i18next'
import {
  AIProviderRegistry,
  buildDefaultReasoningOptions,
  buildVisionPageImagePart,
  runWithOpenAiThinkingInjectAsync
} from '@baishou/ai'
import {
  buildVisionLanguageSlots,
  isVisionModel,
  AI_FIRST_OUTPUT_TIMEOUT_MS,
  logger,
  prepareProviderConfigForRuntime,
  resolveProviderModelSlot,
  resolveReasoningEffortForSlot,
  type AIProviderConfig,
  type GlobalModelsConfig,
  type KnowledgeConfig
} from '@baishou/shared'
import { registerVisionPageRecognizer } from '@baishou/core-desktop'
import { settingsManager } from '../ipc/settings.ipc'

const OCR_PROMPT = `请识别这张 PDF 页面图片中的全部文字，按原文顺序输出纯文本。
不要解释、不要翻译、不要添加页眉说明。若几乎无字，输出空行即可。`

/**
 * 注册视觉 OCR：按视觉、对话、总结的完整槽位依次选用，不把模型名配到另一个服务商。
 */
export function registerDesktopVisionPageRecognizer(): void {
  registerVisionPageRecognizer(
    async ({ pngBase64, page, providerId: overrideProviderId, modelId: overrideModelId }) => {
      const knowledgeConfig = (await settingsManager.get<KnowledgeConfig>('knowledge_config')) || {}
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
      const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []

      const hit = resolveProviderModelSlot(
        providers,
        buildVisionLanguageSlots({
          overrideProviderId,
          overrideModelId,
          visionProviderId: knowledgeConfig.visionProviderId,
          visionModelId: knowledgeConfig.visionModelId
        })
      )
      const modelId = hit?.modelId
      const providerConfig = hit?.provider

      if (!modelId || !providerConfig) {
        throw new Error(
          i18n.t(
            'auto.apps.desktop.src.main.services.register.desktop.vision.ocr.no_model',
            '还没配置视觉模型。请先在设置里选好视觉模型。'
          )
        )
      }
      if (!isVisionModel(modelId, providerConfig.type || providerConfig.id)) {
        throw new Error(`当前模型不是多模态视觉模型：${modelId}`)
      }

      const registry = AIProviderRegistry.getInstance()
      const provider = registry.getOrUpdateProvider(prepareProviderConfigForRuntime(providerConfig))
      const model = provider.getLanguageModel(modelId)

      try {
        const builtReasoning = buildDefaultReasoningOptions({
          modelId,
          providerType: providerConfig.type || providerConfig.id,
          baseUrl: providerConfig.baseUrl,
          effort: resolveReasoningEffortForSlot(globalModels?.reasoningEffortBySlot, 'vision')
        })
        const imagePart = await buildVisionPageImagePart(pngBase64)
        const result = await runWithOpenAiThinkingInjectAsync(
          builtReasoning.openAiThinkingInject,
          async () =>
            generateText({
              model,
              abortSignal: AbortSignal.timeout(AI_FIRST_OUTPUT_TIMEOUT_MS),
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: `${OCR_PROMPT}\n（第 ${page} 页）` },
                    imagePart
                  ]
                }
              ],
              ...(builtReasoning.providerOptions
                ? { providerOptions: builtReasoning.providerOptions as never }
                : {})
            })
        )
        return result.text || ''
      } catch (e) {
        logger.warn('[VisionOCR] failed', e as Error)
        throw new Error(
          `视觉 OCR 失败（第 ${page} 页）：${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
  )
}
