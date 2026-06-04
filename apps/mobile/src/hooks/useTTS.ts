import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

type AudioPlayer = {
  play: () => void
  pause: () => void
  release: () => void
  addListener: (
    event: 'playbackStatusUpdate',
    listener: (status: { didJustFinish?: boolean }) => void
  ) => { remove: () => void }
}

async function loadExpoAudio() {
  return import('expo-audio')
}

export function useTTS() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { services } = useBaishou()
  const [ttsPlayingMsgId, setTtsPlayingMsgId] = useState<string | null>(null)
  const playerRef = useRef<AudioPlayer | null>(null)
  const playbackListenerRef = useRef<{ remove: () => void } | null>(null)

  const stopTTS = useCallback(async () => {
    playbackListenerRef.current?.remove()
    playbackListenerRef.current = null

    if (playerRef.current) {
      try {
        playerRef.current.pause()
        playerRef.current.release()
      } catch {}
      playerRef.current = null
    }
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

        const apiKey = providerConfig.apiKey
        const baseUrl = (providerConfig.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
        const ttsSettings = globalModels?.globalTtsSettings

        const isMimoTts = ttsModelId.toLowerCase().includes('mimo-v2.5-tts')
        let response: Response

        if (isMimoTts) {
          const ttsEndpoint = `${baseUrl}/chat/completions`
          response = await fetch(ttsEndpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: ttsModelId,
              messages: [
                {
                  role: 'user',
                  content: 'Natural, clear and professional speech style.'
                },
                { role: 'assistant', content: content }
              ],
              audio: {
                format: ttsSettings?.responseFormat || 'wav',
                voice: ttsSettings?.voice || '冰糖'
              }
            })
          })
        } else {
          const ttsEndpoint = `${baseUrl}/audio/speech`
          response = await fetch(ttsEndpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: ttsModelId,
              input: content,
              voice: ttsSettings?.voice || 'alloy',
              speed: ttsSettings?.speed || 1.0,
              response_format: ttsSettings?.responseFormat || 'mp3'
            })
          })
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => '')
          console.error(`[TTS] API error ${response.status}: ${errText}`)
          toast.showError(`${t('agent.tts_failed', '语音合成失败')}: API error ${response.status}`)
          return
        }

        let base64 = ''
        if (isMimoTts) {
          const resJson = await response.json()
          const base64Audio = resJson.choices?.[0]?.message?.audio?.data
          if (!base64Audio) {
            console.error(
              `[TTS] MiMo TTS failed: No audio data in chat completions response`,
              resJson
            )
            toast.showError(`${t('agent.tts_failed', '语音合成失败')}: Invalid audio data`)
            return
          }
          base64 = base64Audio
        } else {
          const arrayBuffer = await response.arrayBuffer()
          const bytes = new Uint8Array(arrayBuffer)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          base64 = btoa(binary)
        }

        let createAudioPlayer: (typeof import('expo-audio'))['createAudioPlayer']
        let setAudioModeAsync: (typeof import('expo-audio'))['setAudioModeAsync']
        try {
          const audio = await loadExpoAudio()
          createAudioPlayer = audio.createAudioPlayer
          setAudioModeAsync = audio.setAudioModeAsync
        } catch (e) {
          console.error('[TTS] expo-audio native module unavailable:', e)
          toast.showError('ExpoAudio 原生模块未安装，请重新编译 APK')
          return
        }

        await setAudioModeAsync({ playsInSilentMode: true })
        const audioFormat = isMimoTts ? ttsSettings?.responseFormat || 'wav' : 'mp3'
        const player = createAudioPlayer({
          uri: `data:audio/${audioFormat};base64,${base64}`
        })

        playbackListenerRef.current = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) {
            playbackListenerRef.current?.remove()
            playbackListenerRef.current = null
            player.release()
            playerRef.current = null
            setTtsPlayingMsgId(null)
          }
        })

        playerRef.current = player
        if (messageId) setTtsPlayingMsgId(messageId)
        player.play()
      } catch (e: any) {
        console.error('[TTS] Error:', e)
        toast.showError(`${t('agent.tts_failed', '语音合成失败')}: ${e.message || 'Unknown error'}`)
        setTtsPlayingMsgId(null)
      }
    },
    [ttsPlayingMsgId, services, t, stopTTS]
  )

  return {
    ttsPlayingMsgId,
    handleTtsReadAloud,
    stopTTS
  }
}
