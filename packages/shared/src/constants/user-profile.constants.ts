import { USER_DEFAULT_AVATAR_SENTINEL, type UserProfile } from '../types/user-profile.types'

/** 用户档案在 system_settings / settings.json 中的 canonical 键（与桌面 UserProfileRepository 对齐） */
export const USER_PROFILE_SETTINGS_KEY = 'user_profile_data' as const

/** 移动端历史键，仅用于迁移 */
export const USER_PROFILE_LEGACY_SETTINGS_KEY = 'user_profile' as const

/** 默认用户档案（与桌面 DEFAULT_PROFILE 对齐） */
export const DEFAULT_USER_PROFILE: UserProfile = {
  nickname: '白守用户',
  avatarPath: USER_DEFAULT_AVATAR_SENTINEL,
  activePersonaId: '默认身份卡',
  personas: {
    默认身份卡: {
      id: '默认身份卡',
      facts: {}
    }
  }
}
