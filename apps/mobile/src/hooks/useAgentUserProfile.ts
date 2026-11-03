import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_USER_PROFILE } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import {
  loadAgentUserProfileFromSettings,
  peekAgentUserProfileCache,
  readPersistedAgentUserProfileSnapshot,
  setAgentUserProfileCache,
  type AgentUserProfileState
} from '../lib/agent-user-profile.util'
import {
  consumeUserProfileNeedRefresh,
  subscribeUserProfileRefresh
} from '../lib/user-profile-refresh-signal'
import { resolveChatBackgroundForMobileUi } from '../lib/chat-background-display.util'
import { resolveUserAvatarForMobileUi } from '../lib/user-avatar-display.util'
import { useThrottledFocusRefresh } from './useThrottledFocusRefresh'

const EMPTY_PROFILE: AgentUserProfileState = { nickname: '', isReady: false }

export function useAgentUserProfile(): AgentUserProfileState {
  const { services, dbReady, vaultRevision } = useBaishou()
  const [userProfile, setUserProfile] = useState<AgentUserProfileState>(
    () => peekAgentUserProfileCache() ?? EMPTY_PROFILE
  )

  useEffect(() => {
    if (userProfile.isReady) return
    void readPersistedAgentUserProfileSnapshot().then((snapshot) => {
      if (snapshot) {
        setAgentUserProfileCache(snapshot)
        setUserProfile(snapshot)
      }
    })
  }, [userProfile.isReady])

  const loadUserProfile = useCallback(async () => {
    if (!dbReady || !services) return
    try {
      const next = await loadAgentUserProfileFromSettings(
        services.settingsManager,
        DEFAULT_USER_PROFILE.nickname
      )
      setUserProfile(next)
      if (next.chatBackgroundPath) {
        void resolveChatBackgroundForMobileUi(next.chatBackgroundPath, services.attachmentManager)
      }
      if (next.avatarPath) {
        void resolveUserAvatarForMobileUi(
          next.avatarPath,
          services.attachmentManager,
          services.fileSystem
        )
      }
    } catch {
      setUserProfile((prev) =>
        prev.isReady ? prev : { nickname: DEFAULT_USER_PROFILE.nickname, isReady: true }
      )
    }
  }, [dbReady, services])

  useEffect(() => {
    void loadUserProfile()
  }, [loadUserProfile, vaultRevision])

  useEffect(() => subscribeUserProfileRefresh(() => void loadUserProfile()), [loadUserProfile])

  useThrottledFocusRefresh(loadUserProfile, 2000, consumeUserProfileNeedRefresh)

  return userProfile
}
