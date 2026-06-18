import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from '@baishou/ui'

type TtsSynthesizeSpeechResult =
  | { success: true; segmentCount: number }
  | { success: false; errorCode?: string; error?: string }

/**
 * 封装 Text-to-Speech (TTS) 音频播放、模式控制、生命周期清理状态的自定义 Hook。
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
  const ttsSessionIdRef = useRef<string | null>(null)

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
    const api = (window as any).api
    if (ttsSessionIdRef.current && api?.tts?.cancelSpeech) {
      void api.tts.cancelSpeech(ttsSessionIdRef.current)
      ttsSessionIdRef.current = null
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current = null
    }
    setTtsPlayingMsgId(null)
  }, [])

  const playAudioChunk = useCallback(
    async (audioBase64: string, format: string, requestId: number): Promise<void> => {
      if (requestId !== ttsRequestRef.current) return

      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause()
        ttsAudioRef.current = null
      }

      const audio = new Audio(`data:audio/${format || 'mp3'};base64,${audioBase64}`)
      ttsAudioRef.current = audio

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          if (requestId === ttsRequestRef.current) {
            ttsAudioRef.current = null
          }
          resolve()
        }
        audio.onerror = () => {
          if (requestId === ttsRequestRef.current) {
            ttsAudioRef.current = null
          }
          reject(new Error('TTS playback failed'))
        }
        void audio.play().catch(reject)
      })
    },
    []
  )

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
        if (!api?.tts?.synthesizeSpeech) {
          reportError(t('agent.chat.tts_no_api', 'TTS 功能不可用'))
          return
        }

        stopTts()
        requestId = ++ttsRequestRef.current
        if (messageId) setTtsPlayingMsgId(messageId)

        const sessionId =
          globalThis.crypto?.randomUUID?.() ?? `tts-${Date.now()}-${Math.random()}`
        ttsSessionIdRef.current = sessionId

        const result: TtsSynthesizeSpeechResult = await api.tts.synthesizeSpeech(content, {
          sessionId,
          onSegment: async (segment, _index) => {
            if (requestId !== ttsRequestRef.current) return
            await playAudioChunk(segment.audioBase64, segment.format || 'mp3', requestId)
          }
        })

        ttsSessionIdRef.current = null

        if (requestId !== ttsRequestRef.current) return

        if (result.success === false) {
          if (result.errorCode === 'tts_cancelled' || result.errorCode === 'tts_empty_content') {
            clearTtsBusyState(requestId)
            return
          }

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
          clearTtsBusyState(requestId)
          return
        }

        clearTtsBusyState(requestId)
      } catch (e: any) {
        ttsSessionIdRef.current = null
        if (requestId !== null) {
          clearTtsBusyState(requestId)
        }
        const message = e?.message || ''
        const isPlaybackError = /playback/i.test(message)
        reportError(
          isPlaybackError
            ? t('agent.chat.tts_play_failed', '语音播放失败，已自动切换为手动朗读')
            : message || t('agent.chat.tts_failed', '语音合成失败')
        )
      }
    },
    [t, ttsPlayingMsgId, stopTts, clearTtsBusyState, playAudioChunk]
  )

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
