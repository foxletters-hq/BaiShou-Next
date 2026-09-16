import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AGENT_IDLE_GREETING_FALLBACKS,
  AGENT_IDLE_GREETING_KEYS,
  getUserProfileFromSettings,
  pickAgentIdleGreetingIndex
} from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'

export function useAgentIdleGreeting(enabled: boolean): string {
  const { t } = useTranslation()
  const { services, dbReady } = useBaishou()
  const [nickname, setNickname] = useState('')
  const [index, setIndex] = useState(() => pickAgentIdleGreetingIndex(AGENT_IDLE_GREETING_KEYS.length))
  const prevEnabled = useRef(enabled)

  useEffect(() => {
    if (!dbReady || !services) return
    void getUserProfileFromSettings(services.settingsManager).then((profile) => {
      setNickname(profile?.nickname?.trim() || t('agent.you', '你'))
    })
  }, [dbReady, services, t])

  useEffect(() => {
    if (enabled && !prevEnabled.current) {
      setIndex((prev) => pickAgentIdleGreetingIndex(AGENT_IDLE_GREETING_KEYS.length, prev))
    }
    prevEnabled.current = enabled
  }, [enabled])

  const key = AGENT_IDLE_GREETING_KEYS[index] ?? AGENT_IDLE_GREETING_KEYS[0]
  const fallback = AGENT_IDLE_GREETING_FALLBACKS[index] ?? AGENT_IDLE_GREETING_FALLBACKS[0]
  return t(key, fallback, { name: nickname || t('agent.you', '你') })
}
