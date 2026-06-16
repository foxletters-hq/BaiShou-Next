import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from '@baishou/ui'

/**
 * 封装 Text-to-Speech (TTS) 音频播放、模式控制、生命周期清理状态的自定义 Hook。
 *
 * @param t - 翻译函数
 * @returns 包含 TTS 状态和控制方法的对象
 */
export function useTts(t: any) {
  const [ttsMode, setTtsMode] = useState<'always' | 'manual'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('baishou_tts_mode')
      if (stored === 'always') return 'always'
      if (stored === 'off') {
        localStorage.setItem('baishou_tts_mode', 'manual')
      }
      return 'manual'
    }
    return 'manual'
  })
  const [ttsPlayingMsgId, setTtsPlayingMsgId] = useState<string | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsModeRef = useRef(ttsMode)
  const ttsRequestRef = useRef(0)

  useEffect(() => {
    ttsModeRef.current = ttsMode
  }, [ttsMode])

  const toggleTtsMode = useCallback(() => {
    setTtsMode((prev) => {
      const next = prev === 'manual' ? 'always' : 'manual'
      if (typeof window !== 'undefined') {
        localStorage.setItem('baishou_tts_mode', next)
      }
      return next
    })
  }, [])

  const clearTtsBusyState = useCallback((requestId: number) => {
    if (requestId === ttsRequestRef.current) {
      setTtsPlayingMsgId(null)
    }
  }, [])

  const stopTts = useCallback(() => {
    ttsRequestRef.current += 1
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current = null
    }
    setTtsPlayingMsgId(null)
  }, [])

  const handleTtsReadAloud = useCallback(
    async (content: string, messageId?: string) => {
      if (!content.trim()) return

      if (ttsPlayingMsgId === messageId) {
        stopTts()
        return
      }

      const reportError = (errorMsg: string) => {
        toast.showError(errorMsg)
        if (ttsModeRef.current === 'always') {
          setTtsMode('manual')
          if (typeof window !== 'undefined') {
            localStorage.setItem('baishou_tts_mode', 'manual')
          }
        }
      }

      let requestId: number | null = null

      try {
        const api = (window as any).api
        if (!api?.tts?.synthesize) {
          reportError(t('agent.chat.tts_no_api', 'TTS 功能不可用'))
          return
        }

        stopTts()
        requestId = ++ttsRequestRef.current
        if (messageId) setTtsPlayingMsgId(messageId)

        const result = await api.tts.synthesize(content)
        if (requestId !== ttsRequestRef.current) return

        if (result.success && result.audioBase64) {
          if (ttsAudioRef.current) {
            ttsAudioRef.current.pause()
            ttsAudioRef.current = null
          }
          const audio = new Audio(
            `data:audio/${result.format || 'mp3'};base64,${result.audioBase64}`
          )
          ttsAudioRef.current = audio
          audio.onended = () => {
            clearTtsBusyState(requestId!)
            ttsAudioRef.current = null
          }
          audio.onerror = () => {
            clearTtsBusyState(requestId!)
            ttsAudioRef.current = null
            reportError(t('agent.chat.tts_play_failed', '语音播放失败，已自动切换为手动朗读'))
          }
          try {
            await audio.play()
          } catch (playErr) {
            clearTtsBusyState(requestId!)
            ttsAudioRef.current = null
            reportError(
              t('agent.chat.tts_play_blocked', '语音播放被浏览器拦截或失败，已自动切换为手动朗读')
            )
          }
        } else {
          clearTtsBusyState(requestId)
          const errorCodeMap: Record<string, string> = {
            tts_not_configured: t(
              'agent.chat.tts_not_configured',
              'TTS 模型未配置，请在设置中配置 TTS 模型'
            ),
            tts_provider_not_found: t('agent.chat.tts_provider_not_found', 'TTS 提供商未找到'),
            tts_api_error: t('agent.chat.tts_api_error', 'TTS API 请求失败'),
            tts_synthesis_failed: t('agent.chat.tts_failed', '语音合成失败')
          }
          const errorCode = result.errorCode
          const errorMsg = errorCode
            ? errorCodeMap[errorCode] || t('agent.chat.tts_failed', '语音合成失败')
            : result.error || t('agent.chat.tts_failed', '语音合成失败')
          reportError(errorMsg)
        }
      } catch (e: any) {
        if (requestId !== null) {
          clearTtsBusyState(requestId)
        }
        reportError(e.message || t('agent.chat.tts_failed', '语音合成失败'))
      }
    },
    [t, ttsPlayingMsgId, stopTts, clearTtsBusyState]
  )

  // 卸载组件时清理播放的音频
  useEffect(() => {
    return () => {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause()
        ttsAudioRef.current = null
      }
    }
  }, [])

  return {
    ttsMode,
    ttsPlayingMsgId,
    toggleTtsMode,
    handleTtsReadAloud,
    stopTts
  }
}
