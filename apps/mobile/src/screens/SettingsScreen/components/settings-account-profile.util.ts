import type { UserGender } from '@baishou/shared'
import { invalidateChatBackgroundDisplayCache } from '../../../lib/chat-background-display.util'
import {
  invalidateAgentUserProfileCache,
  peekAgentUserProfileCache
} from '../../../lib/agent-user-profile.util'
import { notifyUserProfileRefresh } from '../../../lib/user-profile-refresh-signal'

export interface SettingsAccountProfileState {
  nickname: string
  birthday?: string | null
  gender?: UserGender | null
  customGender?: string | null
  avatarPath?: string | null
  showIdentityInProfile?: boolean
  shareIdentityWithCompanion?: boolean
}

export function resolveInitialSettingsAccountProfile(): SettingsAccountProfileState {
  const cached = peekAgentUserProfileCache()
  if (!cached) {
    return {
      nickname: '',
      avatarPath: '',
      birthday: null,
      gender: null,
      customGender: null,
      showIdentityInProfile: true,
      shareIdentityWithCompanion: true
    }
  }
  return {
    nickname: cached.nickname || '',
    birthday: cached.birthday ?? null,
    gender: cached.gender ?? null,
    customGender: cached.customGender ?? null,
    avatarPath: cached.avatarPath ?? '',
    showIdentityInProfile: cached.showIdentityInProfile ?? true,
    shareIdentityWithCompanion: cached.shareIdentityWithCompanion ?? true
  }
}

export function notifyAgentProfileRefresh(options?: { chatBackgroundChanged?: boolean }) {
  invalidateAgentUserProfileCache()
  if (options?.chatBackgroundChanged) {
    invalidateChatBackgroundDisplayCache()
  }
  notifyUserProfileRefresh()
}
