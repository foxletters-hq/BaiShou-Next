import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  DEFAULT_USER_PROFILE,
  USER_PROFILE_SETTINGS_KEY,
  normalizeChatBackgroundBlur,
  normalizeChatBackgroundOverlayOpacity,
  type UserGender,
  type UserProfile
} from '@baishou/shared'
import type { SettingsManagerService, IAttachmentManager, IFileSystem } from '@baishou/core-mobile'
import { isCustomUserAvatar } from '@baishou/shared'
import { AGENT_USER_PROFILE_SNAPSHOT_KEY } from '../constants/storage'
import { readOnboardingProfile } from './onboarding-nickname.util'
import { resolveChatBackgroundForMobileUi } from './chat-background-display.util'
import { resolveUserAvatarForMobileUi } from './user-avatar-display.util'

export type AgentUserProfileState = {
  nickname: string
  birthday?: string | null
  gender?: UserGender | null
  customGender?: string | null
  showIdentityInProfile?: boolean
  shareIdentityWithCompanion?: boolean
  avatarPath?: string | null
  chatBackgroundPath?: string | null
  chatBackgroundBlur?: number
  chatBackgroundOverlayOpacity?: number
  isReady?: boolean
}

let agentUserProfileCache: AgentUserProfileState | null = null

export async function readPersistedAgentUserProfileSnapshot(): Promise<AgentUserProfileState | null> {
  try {
    const raw = await AsyncStorage.getItem(AGENT_USER_PROFILE_SNAPSHOT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AgentUserProfileState>
      if (parsed && typeof parsed === 'object' && typeof parsed.nickname === 'string') {
        return {
          nickname: parsed.nickname.trim(),
          birthday: parsed.birthday ?? null,
          gender: parsed.gender ?? null,
          customGender: parsed.customGender ?? null,
          showIdentityInProfile: parsed.showIdentityInProfile ?? true,
          shareIdentityWithCompanion: parsed.shareIdentityWithCompanion ?? true,
          avatarPath: parsed.avatarPath ?? null,
          chatBackgroundPath: parsed.chatBackgroundPath ?? null,
          chatBackgroundBlur: normalizeChatBackgroundBlur(parsed.chatBackgroundBlur),
          chatBackgroundOverlayOpacity: normalizeChatBackgroundOverlayOpacity(
            parsed.chatBackgroundOverlayOpacity
          ),
          isReady: true
        }
      }
    }

    const onboarding = await readOnboardingProfile().catch(() => null)
    if (onboarding?.nickname) {
      return {
        nickname: onboarding.nickname,
        birthday: onboarding.birthday,
        gender: onboarding.gender,
        customGender: onboarding.customGender,
        isReady: true
      }
    }
    return null
  } catch {
    return null
  }
}

export async function persistAgentUserProfileSnapshot(
  profile: AgentUserProfileState
): Promise<void> {
  try {
    await AsyncStorage.setItem(AGENT_USER_PROFILE_SNAPSHOT_KEY, JSON.stringify(profile))
  } catch {
    // 忽略持久化失败
  }
}

// 模块加载时异步尝试快速填充内存缓存，消除冷启动打开伙伴页时的空窗
void readPersistedAgentUserProfileSnapshot().then((snapshot) => {
  if (snapshot && !agentUserProfileCache) {
    agentUserProfileCache = snapshot
  }
})

export function peekAgentUserProfileCache(): AgentUserProfileState | null {
  return agentUserProfileCache
}

export function setAgentUserProfileCache(profile: AgentUserProfileState): void {
  agentUserProfileCache = { ...profile, isReady: true }
  void persistAgentUserProfileSnapshot(agentUserProfileCache)
}

export function invalidateAgentUserProfileCache(): void {
  agentUserProfileCache = null
  void AsyncStorage.removeItem(AGENT_USER_PROFILE_SNAPSHOT_KEY).catch(() => {})
}

export function mapSettingsToAgentUserProfile(
  profile: Partial<UserProfile> | null | undefined,
  fallbackNickname = DEFAULT_USER_PROFILE.nickname
): AgentUserProfileState {
  return {
    nickname: profile?.nickname?.trim() || fallbackNickname,
    birthday: profile?.birthday ?? null,
    gender: profile?.gender ?? null,
    customGender: profile?.customGender ?? null,
    showIdentityInProfile: profile?.showIdentityInProfile ?? true,
    shareIdentityWithCompanion: profile?.shareIdentityWithCompanion ?? true,
    avatarPath: profile?.avatarPath ?? null,
    chatBackgroundPath: profile?.chatBackgroundPath ?? null,
    chatBackgroundBlur: normalizeChatBackgroundBlur(profile?.chatBackgroundBlur),
    chatBackgroundOverlayOpacity: normalizeChatBackgroundOverlayOpacity(
      profile?.chatBackgroundOverlayOpacity
    ),
    isReady: true
  }
}

export async function loadAgentUserProfileFromSettings(
  settingsManager: SettingsManagerService,
  fallbackNickname = DEFAULT_USER_PROFILE.nickname
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
  fallbackNickname = DEFAULT_USER_PROFILE.nickname
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
