import React, { useCallback, useMemo } from 'react'
import { useSettingsStore } from '@baishou/store'
import {
  applyTtsSaveToGlobalModels,
  buildTtsProviderStatesFromGlobal,
  buildTtsSettingsInitialConfig,
  isTtsProviderId,
  type TtsSynthesizeFromSettingsResult
} from '@baishou/shared'
import { TTSProviderSettings } from '@baishou/ui'
import type { TtsProviderConfig } from '@baishou/ui'

export const TTSSettingsPane: React.FC = () => {
  const globalModels = useSettingsStore((state) => state.globalModels)

  const handleSaveConfig = useCallback(async (config: TtsProviderConfig) => {
    const {
      providers,
      globalModels: latestGlobalModels,
      setProviders,
      setGlobalModels
    } = useSettingsStore.getState()

    if (Array.isArray(providers) && providers.some((p) => isTtsProviderId(p.id))) {
      await setProviders(providers.filter((p) => !isTtsProviderId(p.id)))
    }

    const models = useSettingsStore.getState().globalModels ?? latestGlobalModels
    if (!models) return

    await setGlobalModels(applyTtsSaveToGlobalModels(models, config))
  }, [])

  const handleTestTts = useCallback(async (config: TtsProviderConfig, text: string) => {
    try {
      const result = await window.api?.settings?.testTts(config, text)
      if (!result) {
        return { success: false, error: 'TTS 试听不可用' }
      }
      if (!result.success) {
        const failed = result as Extract<TtsSynthesizeFromSettingsResult, { success: false }>
        const errorMsg = failed.error
          ? `${failed.errorCode}: ${failed.error}`
          : failed.errorCode || 'unknown'
        return { success: false, error: errorMsg }
      }
      return { success: true, audioBase64: result.audioBase64, format: result.format }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  }, [])

  const handleFetchModels = useCallback(
    async (providerId: string, apiKey: string, baseUrl: string) => {
      return (
        (await (window as any).api?.settings?.fetchProviderModels(providerId, apiKey, baseUrl)) ||
        []
      )
    },
    []
  )

  const initialProviderStates = useMemo(
    () => buildTtsProviderStatesFromGlobal(globalModels),
    [globalModels]
  )

  const initialConfig = useMemo(() => {
    const savedProviderId = globalModels?.globalTtsProviderId || 'openai-tts'

    return buildTtsSettingsInitialConfig({
      activeProviderId: savedProviderId,
      globalTtsProviderId: globalModels?.globalTtsProviderId,
      globalTtsModelId: globalModels?.globalTtsModelId,
      globalTtsSettings: globalModels?.globalTtsSettings,
      globalTtsProviderConfigs: globalModels?.globalTtsProviderConfigs,
      persisted: initialProviderStates
    })
  }, [globalModels, initialProviderStates])

  const handlePickRefAudio = useCallback(async () => {
    try {
      const pickTtsRefAudio = window.api?.settings?.pickTtsRefAudio
      if (pickTtsRefAudio) {
        return await pickTtsRefAudio()
      }

      const pickFiles = window.api?.pickFiles
      if (pickFiles) {
        const files = await pickFiles({
          title: '选择参考音频',
          properties: ['openFile'],
          filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'mpeg'] }]
        })
        const first = Array.isArray(files) ? files[0] : null
        return typeof first?.filePath === 'string' ? first.filePath : null
      }
    } catch (error) {
      console.error('[TTS] pick ref audio failed:', error)
    }
    return null
  }, [])

  return (
    <div className="settings-pane settings-pane-full">
      <TTSProviderSettings
        initialConfig={initialConfig}
        initialProviderStates={initialProviderStates}
        onSaveConfig={handleSaveConfig}
        onTestTts={handleTestTts}
        onFetchModels={handleFetchModels}
        onPickRefAudio={handlePickRefAudio}
      />
    </div>
  )
}
