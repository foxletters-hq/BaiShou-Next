import { useMemo } from 'react'
import { LATTE_ASSISTANT_NAME } from '@baishou/shared'
import type { TFunction } from 'i18next'
import type { useAgentUserProfile } from '../../../hooks/useAgentUserProfile'
import type { useAgentSession } from '../../../hooks/useAgentSession'
import type { useAgentModel } from '../../../hooks/useAgentModel'

type UserProfile = ReturnType<typeof useAgentUserProfile>
type Session = ReturnType<typeof useAgentSession>
type Model = ReturnType<typeof useAgentModel>

export function useAgentScreenChatProfiles(deps: {
  currentAssistant: Model['currentAssistant']
  resolvedCurrentAvatarUri: string | null | undefined
  resolvedUserAvatarUri: string | null | undefined
  userProfile: UserProfile
  messages: Session['messages']
  t: TFunction
}) {
  const {
    currentAssistant,
    resolvedCurrentAvatarUri,
    resolvedUserAvatarUri,
    userProfile,
    messages,
    t
  } = deps

  const assistantDisplayName = currentAssistant?.name || LATTE_ASSISTANT_NAME
  const chatAiProfile = useMemo(
    () => ({
      name: assistantDisplayName,
      emoji: currentAssistant?.emoji,
      avatarPath: currentAssistant?.avatarPath || null,
      resolvedAvatarUri: resolvedCurrentAvatarUri || null
    }),
    [assistantDisplayName, currentAssistant, resolvedCurrentAvatarUri]
  )
  const chatUserProfile = useMemo(
    () => ({
      nickname: userProfile.nickname || t('agent.chat.you_label', '你'),
      avatarPath: userProfile.avatarPath,
      resolvedAvatarUri: resolvedUserAvatarUri || null
    }),
    [userProfile, t, resolvedUserAvatarUri]
  )
  const lastMessage = messages[messages.length - 1]

  return { assistantDisplayName, chatAiProfile, chatUserProfile, lastMessage }
}
