import { ipcMain } from 'electron'
import { logger } from '@baishou/shared'
import { settingsManager } from './settings.ipc'
import { GlobalModelsConfig } from '@baishou/shared'
import {
  OpenAiTtsProvider,
  MimoTtsProvider,
  CloneTtsProvider,
  GptSovitsProvider,
  TtsProviderRegistry,
  TtsProviderNotFoundError,
  TtsApiError,
  TtsInvalidResponseError,
  TtsNotConfiguredError
} from '@baishou/shared'

const registry = new TtsProviderRegistry()
registry.register(new OpenAiTtsProvider())
registry.register(new MimoTtsProvider())
registry.register(new CloneTtsProvider())
registry.register(new GptSovitsProvider())

export function registerTtsIPC() {
  ipcMain.handle(
    'agent:tts-synthesize',
    async (_event, text: string, providerId?: string, modelId?: string) => {
      try {
        const providers = (await settingsManager.get<any[]>('ai_providers')) || []
        const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')

        const ttsProviderId = providerId || globalModels?.globalTtsProviderId
        const ttsModelId = modelId || globalModels?.globalTtsModelId

        if (!ttsProviderId || !ttsModelId) {
          return { success: false, errorCode: 'tts_not_configured' }
        }

        const providerConfig = providers.find((p: any) => p.id === ttsProviderId)
        if (!providerConfig) {
          return { success: false, errorCode: 'tts_provider_not_found' }
        }

        let ttsProvider = registry.get(ttsProviderId)
        if (!ttsProvider) {
          ttsProvider = registry.findByModel(ttsModelId)
        }
        if (!ttsProvider) {
          logger.error(`[TTS] No provider found for ID: ${ttsProviderId} or model: ${ttsModelId}`)
          return { success: false, errorCode: 'tts_provider_not_supported' }
        }

        const ttsSettings = globalModels?.globalTtsSettings

        const result = await ttsProvider.synthesize(
          {
            text,
            modelId: ttsModelId,
            settings: {
              voice: ttsSettings?.voice || '',
              speed: ttsSettings?.speed,
              responseFormat: ttsSettings?.responseFormat || '',
              refAudioPath: ttsSettings?.refAudioPath,
              promptText: ttsSettings?.promptText,
              promptLang: ttsSettings?.promptLang,
              textLang: ttsSettings?.textLang
            }
          },
          {
            baseUrl: providerConfig.baseUrl || 'https://api.openai.com/v1',
            apiKey: providerConfig.apiKey
          }
        )

        return { success: true, audioBase64: result.audioBase64, format: result.format }
      } catch (error: any) {
        logger.error('[TTS] Synthesize error:', error)

        if (error instanceof TtsNotConfiguredError) {
          return { success: false, errorCode: 'tts_not_configured' }
        }
        if (error instanceof TtsProviderNotFoundError) {
          return { success: false, errorCode: 'tts_provider_not_found' }
        }
        if (error instanceof TtsApiError) {
          return { success: false, errorCode: 'tts_api_error', statusCode: error.statusCode }
        }
        if (error instanceof TtsInvalidResponseError) {
          return { success: false, errorCode: 'tts_invalid_response_data' }
        }

        return { success: false, errorCode: 'tts_synthesis_failed', error: error.message }
      }
    }
  )
}
