import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AGENT_IDLE_GREETING_KEYS, pickAgentIdleGreetingIndex } from '@baishou/shared'
import { useUserProfileStore } from '@baishou/store'
import { MainPageCacheActiveContext } from '../../../layouts/main-page-cache.context'

export { AGENT_IDLE_GREETING_KEYS, pickAgentIdleGreetingIndex }

/** 伙伴页空态：Latte 右侧随机一句邀请分享感受（i18n） */
export function useAgentIdleGreeting(): string {
  const { t } = useTranslation()
  const nickname = useUserProfileStore((s) => s.profile?.nickname)
  const isPageActive = useContext(MainPageCacheActiveContext)
  const [index, setIndex] = useState(() =>
    pickAgentIdleGreetingIndex(AGENT_IDLE_GREETING_KEYS.length)
  )
  const wasActiveRef = useRef(isPageActive)

  useEffect(() => {
    if (isPageActive && !wasActiveRef.current) {
      setIndex((prev) => pickAgentIdleGreetingIndex(AGENT_IDLE_GREETING_KEYS.length, prev))
    }
    wasActiveRef.current = isPageActive
  }, [isPageActive])

  return useMemo(() => {
    const name =
      (typeof nickname === 'string' && nickname.trim()) || t('agent.idle_greeting_guest', '朋友')
    const key = AGENT_IDLE_GREETING_KEYS[index]!
    return t(key, { name })
  }, [index, nickname, t])
}
