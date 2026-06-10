import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { synthesizeTtsFromSavedSettings } from '../services/mobile-tts-synthesize'
import { playTtsAudio, stopTtsAudioPlayback } from '../services/play-tts-audio'

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

        const result = await synthesizeTtsFromSavedSettings(services.settingsManager, content)
        if (!result.success) {
          console.error('[TTS] Synthesize failed:', result.error)
          const errorCodeMap: Record<string, string> = {
            tts_not_configured: t('agent.tts_configure_hint', '请在设置中配置 TTS 模型'),
            tts_provider_not_found: t('agent.tts_provider_not_found', 'TTS 提供商未找到'),
            tts_api_error: t('agent.tts_failed', '语音合成失败'),
            tts_synthesis_failed: t('agent.tts_failed', '语音合成失败')
          }
          const errorMsg =
            (result.errorCode && errorCodeMap[result.errorCode]) ||
            `${t('agent.tts_failed', '语音合成失败')}: ${result.error}`
          toast.showError(errorMsg)
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
