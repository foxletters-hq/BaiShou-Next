import i18n from 'i18next'
import {
  USER_PROFILE_SETTINGS_KEY,
  normalizeChatBackgroundBlur,
  normalizeChatBackgroundOverlayOpacity,
  type UserProfile
} from '@baishou/shared'
import type { SettingsManagerService, IAttachmentManager, IFileSystem } from '@baishou/core-mobile'
import { isCustomUserAvatar } from '@baishou/shared'
import { resolveChatBackgroundForMobileUi } from './chat-background-display.util'
import { resolveUserAvatarForMobileUi } from './user-avatar-display.util'

export type AgentUserProfileState = {
  nickname: string
  avatarPath?: string | null
  chatBackgroundPath?: string | null
  chatBackgroundBlur?: number
  chatBackgroundOverlayOpacity?: number
}

let agentUserProfileCache: AgentUserProfileState | null = null

export function peekAgentUserProfileCache(): AgentUserProfileState | null {
  return agentUserProfileCache
}

export function setAgentUserProfileCache(profile: AgentUserProfileState): void {
  agentUserProfileCache = profile
}

export function invalidateAgentUserProfileCache(): void {
  agentUserProfileCache = null
}

export function mapSettingsToAgentUserProfile(
  profile: Partial<UserProfile> | null | undefined,
  fallbackNickname: string
): AgentUserProfileState {
  return {
    nickname: profile?.nickname?.trim() || fallbackNickname,
    avatarPath: profile?.avatarPath ?? null,
    chatBackgroundPath: profile?.chatBackgroundPath ?? null,
    chatBackgroundBlur: normalizeChatBackgroundBlur(profile?.chatBackgroundBlur),
    chatBackgroundOverlayOpacity: normalizeChatBackgroundOverlayOpacity(
      profile?.chatBackgroundOverlayOpacity
    )
  }
}

export async function loadAgentUserProfileFromSettings(
  settingsManager: SettingsManagerService,
  fallbackNickname: string
): Promise<AgentUserProfileState> {
  const profile = await settingsManager.get<Partial<UserProfile>>(USER_PROFILE_SETTINGS_KEY)
  const next = mapSettingsToAgentUserProfile(profile, fallbackNickname)
  setAgentUserProfileCache(next)
  return next
}

/** 应用启动后预热用户资料与聊天背景 URI，减少首次进入伙伴页/设置页等待 */
export async function warmAgentScreenCaches(
  settingsManager: SettingsManagerService,
  attachmentManager: IAttachmentManager,
  fileSystem: IFileSystem,
  fallbackNickname = i18n.t('auto.apps.mobile.src.lib.agent.user.profile.util.L64', '白守用户')
): Promise<void> {
  try {
    const profile = await loadAgentUserProfileFromSettings(settingsManager, fallbackNickname)
    if (profile.chatBackgroundPath) {
      await resolveChatBackgroundForMobileUi(profile.chatBackgroundPath, attachmentManager)
    }
    if (isCustomUserAvatar(profile.avatarPath)) {
      await resolveUserAvatarForMobileUi(profile.avatarPath, attachmentManager, fileSystem)
    }
  } catch (e) {
    console.warn('[AgentUserProfile] warm caches failed:', e)
  }
}
