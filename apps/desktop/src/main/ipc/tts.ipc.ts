import { ipcMain } from 'electron'
import { logger, synthesizeTtsFromFormConfig, synthesizeTtsFromSettings } from '@baishou/shared'
import { settingsManager } from './settings.ipc'
import { GlobalModelsConfig, TtsFormSynthesizeConfig } from '@baishou/shared'
import {
  OpenAiTtsProvider,
  MimoTtsProvider,
  CloneTtsProvider,
  GptSovitsProvider,
  TtsProviderRegistry
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
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')

      const result = await synthesizeTtsFromSettings(registry, {
        globalModels,
        text,
        providerId,
        modelId
      })

      if (!result.success) {
        if (result.errorCode === 'tts_provider_not_supported') {
          logger.error(
            `[TTS] No provider found for ID: ${providerId || globalModels?.globalTtsProviderId}`
          )
        } else if (
          result.errorCode === 'tts_synthesis_failed' ||
          result.errorCode === 'tts_api_error'
        ) {
          logger.error('[TTS] Synthesize error:', result.error)
        }
      }

      return result
    }
  )

  ipcMain.handle(
    'settings:tts-test',
    async (_event, config: TtsFormSynthesizeConfig, text: string) => {
      const result = await synthesizeTtsFromFormConfig(registry, config, text)

      if (!result.success) {
        if (result.errorCode === 'tts_provider_not_supported') {
          logger.error(`[TTS] No provider found for form config provider: ${config?.id}`)
        } else if (
          result.errorCode === 'tts_synthesis_failed' ||
          result.errorCode === 'tts_api_error'
        ) {
          logger.error('[TTS] Form synthesize error:', result.error)
        }
      }

      return result
    }
  )
}
