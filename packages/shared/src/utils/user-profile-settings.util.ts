import {
  DEFAULT_USER_PROFILE,
  USER_PROFILE_LEGACY_SETTINGS_KEY,
  USER_PROFILE_SETTINGS_KEY
} from '../constants/user-profile.constants'
import type { UserProfile } from '../types/user-profile.types'

export interface UserProfileSettingsStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
}

function hasPersonas(profile: UserProfile | null | undefined): profile is UserProfile {
  return Boolean(profile?.personas && Object.keys(profile.personas).length > 0)
}

/**
 * 将移动端历史键 `user_profile` 迁移到 canonical 键 `user_profile_data`。
 * @returns 是否写入了 SQLite（含删除 legacy 键）
 */
export async function migrateUserProfileSettingsKey(
  store: UserProfileSettingsStore
): Promise<boolean> {
  let changed = false

  const canonical = await store.get<UserProfile>(USER_PROFILE_SETTINGS_KEY)
  const legacy = await store.get<UserProfile>(USER_PROFILE_LEGACY_SETTINGS_KEY)

  if (!hasPersonas(canonical) && hasPersonas(legacy)) {
    await store.set(USER_PROFILE_SETTINGS_KEY, legacy)
    changed = true
  }

  if (legacy) {
    await store.delete(USER_PROFILE_LEGACY_SETTINGS_KEY)
    changed = true
  }

  return changed
}

/** 读取用户档案；不存在时返回默认档案（不持久化） */
export async function getUserProfileFromSettings(
  store: Pick<UserProfileSettingsStore, 'get'>
): Promise<UserProfile> {
  const profile = await store.get<UserProfile>(USER_PROFILE_SETTINGS_KEY)
  return hasPersonas(profile) ? profile : DEFAULT_USER_PROFILE
}

/** 保存用户档案到 canonical 键 */
export async function saveUserProfileToSettings(
  store: Pick<UserProfileSettingsStore, 'set'>,
  profile: UserProfile
): Promise<void> {
  await store.set(USER_PROFILE_SETTINGS_KEY, profile)
}
