import { generateText } from 'ai'
import {
  AIProviderRegistry,
  buildDefaultReasoningOptions,
  buildVisionPageImagePart,
  runWithOpenAiThinkingInjectAsync
} from '@baishou/ai'
import {
  buildVisionLanguageSlots,
  AI_FIRST_OUTPUT_TIMEOUT_MS,
  isVisionModel,
  prepareProviderConfigForRuntime,
  resolveProviderModelSlot,
  resolveReasoningEffortForSlot,
  type AIProviderConfig,
  type GlobalModelsConfig,
  type KnowledgeConfig
} from '@baishou/shared'
import { registerVisionPageRecognizer } from '@baishou/core-mobile'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'

const OCR_PROMPT = `请识别这张 PDF 页面图片中的全部文字，按原文顺序输出纯文本。
不要解释、不要翻译、不要添加页眉说明。若几乎无字，输出空行即可。`

export function registerMobileVisionPageRecognizer(): void {
  registerVisionPageRecognizer(
    async ({ pngBase64, page, providerId: overrideProviderId, modelId: overrideModelId }) => {
      const settings = agentDbRuntimeRef.current?.settingsManager
      if (!settings) throw new Error('runtime not ready')
      const knowledgeConfig = (await settings.get<KnowledgeConfig>('knowledge_config')) || {}
      const globalModels = (await settings.get<GlobalModelsConfig>('global_models')) || {}
      const providers = (await settings.get<AIProviderConfig[]>('ai_providers')) || []
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
        throw new Error('还没配置视觉模型。请先在设置里选好视觉模型。')
      }
      if (!isVisionModel(modelId, providerConfig.type || providerConfig.id)) {
        throw new Error(`当前模型不是多模态视觉模型：${modelId}`)
      }
      const registry = AIProviderRegistry.getInstance()
      const provider = registry.getOrUpdateProvider(prepareProviderConfigForRuntime(providerConfig))
      const model = provider.getLanguageModel(modelId)
      const builtReasoning = buildDefaultReasoningOptions({
        modelId,
        providerType: providerConfig.type || providerConfig.id,
        baseUrl: providerConfig.baseUrl,
        effort: resolveReasoningEffortForSlot(globalModels.reasoningEffortBySlot, 'vision')
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
            ]
          })
      )
      return String(result.text || '').trim()
    }
  )
}
