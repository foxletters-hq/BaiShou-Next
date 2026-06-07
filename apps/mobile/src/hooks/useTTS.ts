import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast, type TtsProviderConfig } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { synthesizeTtsForTest } from '../services/mobile-tts-synthesize'
import { playTtsAudio, stopTtsAudioPlayback } from '../services/play-tts-audio'

function buildGlobalTtsConfig(
  ttsProviderId: string,
  ttsModelId: string,
  providerConfig: Record<string, unknown>,
  ttsSettings: Record<string, unknown> | undefined
): TtsProviderConfig {
  return {
    id: ttsProviderId,
    name: ttsProviderId,
    baseUrl: (providerConfig.baseUrl as string) || 'https://api.openai.com/v1',
    apiKey: (providerConfig.apiKey as string) || '',
    modelId: ttsModelId,
    voice: (ttsSettings?.voice as string) || '',
    speed: (ttsSettings?.speed as number) ?? 1,
    responseFormat: (ttsSettings?.responseFormat as string) || 'mp3',
    refAudioPath: (ttsSettings?.refAudioPath as string) || '',
    promptText: (ttsSettings?.promptText as string) || '',
    promptLang: (ttsSettings?.promptLang as string) || 'zh',
    textLang: (ttsSettings?.textLang as string) || 'zh'
  }
}

export function useTTS() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { services } = useBaishou()
  const [ttsPlayingMsgId, setTtsPlayingMsgId] = useState<string | null>(null)

  const stopTTS = useCallback(async () => {
    await stopTtsAudioPlayback()
    setTtsPlayingMsgId(null)
  }, [])

  const handleTtsReadAloud = useCallback(
    async (content: string, messageId?: string) => {
      if (!content.trim()) return

      if (ttsPlayingMsgId === messageId) {
        await stopTTS()
        return
      }

      await stopTTS()

      try {
        if (!services) {
          toast.showError(t('agent.tts_service_not_ready', '服务未就绪'))
          return
        }

        const globalModels = await services.settingsManager.get<any>('global_models')
        const providers = (await services.settingsManager.get<any[]>('ai_providers')) || []

        const ttsProviderId = globalModels?.globalTtsProviderId
        const ttsModelId = globalModels?.globalTtsModelId

        if (!ttsProviderId || !ttsModelId) {
          toast.showError(t('agent.tts_configure_hint', '请在设置中配置 TTS 模型'))
          return
        }

        const providerConfig = providers.find((p: any) => p.id === ttsProviderId)
        if (!providerConfig) {
          toast.showError(t('agent.tts_provider_not_found', 'TTS 提供商未找到'))
          return
        }

        const config = buildGlobalTtsConfig(
          ttsProviderId,
          ttsModelId,
          providerConfig,
          globalModels?.globalTtsSettings
        )

        const result = await synthesizeTtsForTest(config, content)
        if (!result.success) {
          console.error('[TTS] Synthesize failed:', result.error)
          toast.showError(`${t('agent.tts_failed', '语音合成失败')}: ${result.error}`)
          return
        }

        if (messageId) setTtsPlayingMsgId(messageId)
        await playTtsAudio(result.audioBase64, result.format, () => {
          setTtsPlayingMsgId(null)
        })
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        console.error('[TTS] Error:', e)
        toast.showError(`${t('agent.tts_failed', '语音合成失败')}: ${message}`)
        setTtsPlayingMsgId(null)
      }
    },
    [ttsPlayingMsgId, services, t, stopTTS, toast]
  )

  return {
    ttsPlayingMsgId,
    handleTtsReadAloud,
    stopTTS
  }
}
