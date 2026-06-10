import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { isTtsProviderId } from '@baishou/ui/native'

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

      if (!isTtsProviderId(providerId)) {
        providerId = 'openai-tts'
      }
      setTargetProvider(providerId)
    })()
  }, [dbReady, services])

  if (!targetProvider) return null

  return <Redirect href={`/settings/tts/${targetProvider}`} />
}
