import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBaishou } from '../providers/BaishouProvider'
import {
  loadAgentUserProfileFromSettings,
  peekAgentUserProfileCache,
  type AgentUserProfileState
} from '../lib/agent-user-profile.util'
import {
  consumeUserProfileNeedRefresh,
  subscribeUserProfileRefresh
} from '../lib/user-profile-refresh-signal'
import { resolveChatBackgroundForMobileUi } from '../lib/chat-background-display.util'
import { useThrottledFocusRefresh } from './useThrottledFocusRefresh'

const EMPTY_PROFILE: AgentUserProfileState = { nickname: '' }

export function useAgentUserProfile(): AgentUserProfileState {
  const { t } = useTranslation()
  const { services, dbReady, vaultRevision } = useBaishou()
  const [userProfile, setUserProfile] = useState<AgentUserProfileState>(
    () => peekAgentUserProfileCache() ?? EMPTY_PROFILE
  )

  const loadUserProfile = useCallback(async () => {
    if (!dbReady || !services) return
    try {
      const next = await loadAgentUserProfileFromSettings(
        services.settingsManager,
        t('agent.chat.you_label', '你')
      )
      setUserProfile(next)
      if (next.chatBackgroundPath) {
        void resolveChatBackgroundForMobileUi(next.chatBackgroundPath, services.attachmentManager)
      }
    } catch {
      setUserProfile({ nickname: t('agent.chat.you_label', '你') })
    }
  }, [dbReady, services, t])

  useEffect(() => {
    void loadUserProfile()
  }, [loadUserProfile, vaultRevision])

  useEffect(() => subscribeUserProfileRefresh(() => void loadUserProfile()), [loadUserProfile])

  useThrottledFocusRefresh(loadUserProfile, 2000, consumeUserProfileNeedRefresh)

  return userProfile
}
