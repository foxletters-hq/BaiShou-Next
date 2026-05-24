import { useState, useRef, useCallback } from 'react'
import { Alert } from 'react-native'
import { Audio } from 'expo-av'
import { useTranslation } from 'react-i18next'
import { useBaishou } from '../providers/BaishouProvider'

export function useTTS() {
  const { t } = useTranslation()
  const { services } = useBaishou()
  const [ttsPlayingMsgId, setTtsPlayingMsgId] = useState<string | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)

  const stopTTS = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync()
        await soundRef.current.unloadAsync()
      } catch {}
      soundRef.current = null
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
          Alert.alert(t('common.error', '错误'), t('agent.tts_service_not_ready', '服务未就绪'))
          return
        }

        const globalModels = await services.settingsManager.get<any>('global_models')
        const providers = (await services.settingsManager.get<any[]>('ai_providers')) || []

        const ttsProviderId = globalModels?.globalTtsProviderId
        const ttsModelId = globalModels?.globalTtsModelId

        if (!ttsProviderId || !ttsModelId) {
          Alert.alert(
            t('agent.tts_not_configured', 'TTS 未配置'),
            t('agent.tts_configure_hint', '请在设置中配置 TTS 模型')
          )
          return
        }

        const providerConfig = providers.find((p: any) => p.id === ttsProviderId)
        if (!providerConfig) {
          Alert.alert(
            t('common.error', '错误'),
            t('agent.tts_provider_not_found', 'TTS 提供商未找到')
          )
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
          Alert.alert(t('agent.tts_failed', '语音合成失败'), `API error: ${response.status}`)
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
            Alert.alert(t('agent.tts_failed', '语音合成失败'), 'Invalid audio data returned')
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

        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
        const audioFormat = isMimoTts ? ttsSettings?.responseFormat || 'wav' : 'mp3'
        const { sound } = await Audio.Sound.createAsync(
          { uri: `data:audio/${audioFormat};base64,${base64}` },
          { shouldPlay: true }
        )

        soundRef.current = sound
        if (messageId) setTtsPlayingMsgId(messageId)

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setTtsPlayingMsgId(null)
            soundRef.current = null
          }
        })
      } catch (e: any) {
        console.error('[TTS] Error:', e)
        Alert.alert(t('agent.tts_failed', '语音合成失败'), e.message || 'Unknown error')
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
