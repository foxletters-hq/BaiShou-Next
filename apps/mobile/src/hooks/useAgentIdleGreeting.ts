import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AGENT_IDLE_GREETING_FALLBACKS,
  AGENT_IDLE_GREETING_KEYS,
  getUserProfileFromSettings,
  normalizeGraphAwakenNickname,
  pickAgentIdleGreetingIndex
} from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import {
  peekAgentUserProfileCache,
  readPersistedAgentUserProfileSnapshot
} from '../lib/agent-user-profile.util'

export function useAgentIdleGreeting(enabled: boolean): string {
  const { t } = useTranslation()
  const { services, dbReady, vaultRevision } = useBaishou()
  const [nickname, setNickname] = useState(
    () => normalizeGraphAwakenNickname(peekAgentUserProfileCache()?.nickname?.trim() || '') ?? ''
  )
  const [index, setIndex] = useState(() =>
    pickAgentIdleGreetingIndex(AGENT_IDLE_GREETING_KEYS.length)
  )
  const prevEnabled = useRef(enabled)

  useEffect(() => {
    if (nickname) return
    void readPersistedAgentUserProfileSnapshot().then((snapshot) => {
      const cached = normalizeGraphAwakenNickname(snapshot?.nickname)
      if (cached) {
        setNickname(cached)
      }
    })
  }, [nickname])

  useEffect(() => {
    if (!dbReady || !services) return
    void getUserProfileFromSettings(services.settingsManager).then((profile) => {
      setNickname(normalizeGraphAwakenNickname(profile?.nickname) ?? '')
    })
  }, [dbReady, services, vaultRevision])

  useEffect(() => {
    if (enabled && !prevEnabled.current) {
      setIndex((prev) => pickAgentIdleGreetingIndex(AGENT_IDLE_GREETING_KEYS.length, prev))
    }
    prevEnabled.current = enabled
  }, [enabled])

  const key = AGENT_IDLE_GREETING_KEYS[index] ?? AGENT_IDLE_GREETING_KEYS[0]
  const fallback = AGENT_IDLE_GREETING_FALLBACKS[index] ?? AGENT_IDLE_GREETING_FALLBACKS[0]
  return useMemo(() => {
    const name =
      (typeof nickname === 'string' && nickname.trim()) || t('agent.idle_greeting_guest', '朋友')
    return t(key, fallback, { name })
  }, [fallback, key, nickname, t])
}
