import { generateText } from 'ai'
import i18n from 'i18next'
import { AIProviderRegistry } from '@baishou/ai'
import {
  isVisionModel,
  logger,
  prepareProviderConfigForRuntime,
  type AIProviderConfig,
  type GlobalModelsConfig
} from '@baishou/shared'
import { registerVisionPageRecognizer } from '@baishou/core-desktop'
import { settingsManager } from '../ipc/settings.ipc'

const OCR_PROMPT = `请识别这张 PDF 页面图片中的全部文字，按原文顺序输出纯文本。
不要解释、不要翻译、不要添加页眉说明。若几乎无字，输出空行即可。`

/**
 * 注册视觉 OCR：复用全局对话模型（须为多模态）。
 */
export function registerDesktopVisionPageRecognizer(): void {
  registerVisionPageRecognizer(async ({ pngBase64, page }) => {
    const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
    const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []

    const modelId = globalModels?.globalDialogueModelId || globalModels?.globalSummaryModelId
    const providerId =
      globalModels?.globalDialogueProviderId || globalModels?.globalSummaryProviderId
    const providerConfig =
      providers.find((p) => p.id === providerId) || providers.find((p) => p.isEnabled)

    if (!modelId || !providerConfig) {
      throw new Error(
        i18n.t(
          'auto.apps.desktop.src.main.services.register.desktop.vision.ocr.no_model',
          '未配置对话模型，无法使用视觉 OCR'
        )
      )
    }
    if (!isVisionModel(modelId, providerConfig.type || providerConfig.id)) {
      throw new Error(`当前对话模型不是多模态视觉模型：${modelId}`)
    }

    const registry = AIProviderRegistry.getInstance()
    const provider = registry.getOrUpdateProvider(prepareProviderConfigForRuntime(providerConfig))
    const model = provider.getLanguageModel(modelId)

    try {
      const result = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `${OCR_PROMPT}\n（第 ${page} 页）` },
              { type: 'image', image: `data:image/png;base64,${pngBase64}` }
            ]
          }
        ]
      })
      return result.text || ''
    } catch (e) {
      logger.warn('[VisionOCR] failed', e as Error)
      throw new Error(
        `视觉 OCR 失败（第 ${page} 页）：${e instanceof Error ? e.message : String(e)}`
      )
    }
  })
}
