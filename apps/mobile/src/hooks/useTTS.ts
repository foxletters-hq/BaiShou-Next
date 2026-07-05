import { useState, useCallback, useRef, useEffect } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { registerTtsPlaybackStopHandler, stopAllTtsPlayback } from '@baishou/shared'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { synthesizeAllTtsSpeechFromSavedSettings } from '../services/mobile-tts-synthesize'
import { playTtsAudioSequence, stopTtsAudioPlayback } from '../services/play-tts-audio'

export function useTTS() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { services } = useBaishou()
  const [ttsPlayingMsgId, setTtsPlayingMsgId] = useState<string | null>(null)
  const ttsRequestRef = useRef(0)

  const clearTtsBusyState = useCallback((requestId: number) => {
    if (requestId === ttsRequestRef.current) {
      setTtsPlayingMsgId(null)
    }
  }, [])

  const stopTTS = useCallback(async () => {
    ttsRequestRef.current += 1
    await stopTtsAudioPlayback()
    setTtsPlayingMsgId(null)
  }, [])

  useEffect(() => registerTtsPlaybackStopHandler(() => stopTTS()), [stopTTS])

  useFocusEffect(
    useCallback(() => {
      return () => {
        void stopTTS()
      }
    }, [stopTTS])
  )

  const handleTtsReadAloud = useCallback(
    async (content: string, messageId?: string) => {
      if (!content.trim()) return

      if (ttsPlayingMsgId === messageId) {
        await stopAllTtsPlayback()
        return
      }

      await stopAllTtsPlayback()

      const requestId = ++ttsRequestRef.current
      if (messageId) setTtsPlayingMsgId(messageId)

      try {
        if (!services) {
          clearTtsBusyState(requestId)
          toast.showError(t('agent.tts_service_not_ready', '服务未就绪'))
          return
        }

        const result = await synthesizeAllTtsSpeechFromSavedSettings(
          services.settingsManager,
          content,
          {
            isCancelled: () => requestId !== ttsRequestRef.current
          }
        )

        if (requestId !== ttsRequestRef.current) return

        if (!result.success) {
          if (result.errorCode === 'tts_cancelled' || result.errorCode === 'tts_empty_content') {
            clearTtsBusyState(requestId)
            return
          }

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
          clearTtsBusyState(requestId)
          return
        }

        await playTtsAudioSequence(result.segments)

        if (requestId !== ttsRequestRef.current) return

        clearTtsBusyState(requestId)
      } catch (e: unknown) {
        if (requestId !== ttsRequestRef.current) return
        const message = e instanceof Error ? e.message : 'Unknown error'
        console.error('[TTS] Error:', e)
        const isPlaybackError = /playback/i.test(message)
        const errorLabel = isPlaybackError
          ? t('agent.tts_play_failed', '语音播放失败')
          : t('agent.tts_failed', '语音合成失败')
        toast.showError(`${errorLabel}: ${message}`)
        clearTtsBusyState(requestId)
      }
    },
    [ttsPlayingMsgId, services, t, toast, clearTtsBusyState]
  )

  return {
    ttsPlayingMsgId,
    handleTtsReadAloud,
    stopTTS
  }
}
