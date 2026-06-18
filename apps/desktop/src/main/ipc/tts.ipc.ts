import { ipcMain, dialog, BrowserWindow } from 'electron'
import { logger, synthesizeTtsFromFormConfig, synthesizeTtsFromSettings } from '@baishou/shared'
import { settingsManager } from './settings.ipc'
import { GlobalModelsConfig, TtsFormSynthesizeConfig } from '@baishou/shared'
import { getDefaultTtsRegistry } from '@baishou/shared'

const registry = getDefaultTtsRegistry()

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

  ipcMain.handle('settings:pick-tts-ref-audio', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(window ?? undefined, {
      title: '选择参考音频',
      properties: ['openFile'],
      filters: [
        { name: 'Audio', extensions: ['wav', 'mp3', 'mpeg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0] ?? null
  })
}
