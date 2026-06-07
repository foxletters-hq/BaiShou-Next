import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { isTtsProviderId } from '@baishou/ui/native'

const TTS_CONFIGS_STORAGE_KEY = 'baishou_tts_provider_configs'

export default function TtsSettingsIndexRoute() {
  const { services, dbReady } = useBaishou()
  const [targetProvider, setTargetProvider] = useState<string | null>(null)

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const globalModels =
        (await services.settingsManager.get<{ globalTtsProviderId?: string }>('global_models')) ||
        {}
      let providerId = globalModels.globalTtsProviderId || 'openai-tts'

      try {
        const saved = await AsyncStorage.getItem(TTS_CONFIGS_STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, unknown>
          const lastActive = parsed.__lastActiveProviderId
          if (typeof lastActive === 'string' && isTtsProviderId(lastActive)) {
            providerId = lastActive
          }
        }
      } catch {
        /* ignore */
      }

      if (!isTtsProviderId(providerId)) {
        providerId = 'openai-tts'
      }
      setTargetProvider(providerId)
    })()
  }, [dbReady, services])

  if (!targetProvider) return null

  return <Redirect href={`/settings/tts/${targetProvider}`} />
}
