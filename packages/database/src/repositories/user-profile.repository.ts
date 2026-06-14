import { eq } from 'drizzle-orm'
import { systemSettingsTable } from '../schema/system-settings'
import {
  USER_DEFAULT_AVATAR_SENTINEL,
  isCustomUserAvatar,
  DEFAULT_USER_PROFILE,
  USER_PROFILE_SETTINGS_KEY,
  type UserProfile
} from '@baishou/shared'

const KEY = USER_PROFILE_SETTINGS_KEY

function withNormalizedAvatar(profile: UserProfile): UserProfile {
  if (isCustomUserAvatar(profile.avatarPath)) return profile
  return { ...profile, avatarPath: USER_DEFAULT_AVATAR_SENTINEL }
}

export const DEFAULT_PROFILE = DEFAULT_USER_PROFILE

export class UserProfileRepository {
  public readonly table = systemSettingsTable // exposed for tests if needed

  constructor(private readonly db: any) {}

  /**
   * 获取用户档案聚合 JSON。
   */
  async getProfile(): Promise<UserProfile> {
    const result = await this.db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, KEY))
      .limit(1)

    if (result.length === 0) {
      return withNormalizedAvatar(DEFAULT_PROFILE)
    }

    try {
      return withNormalizedAvatar(JSON.parse(result[0].value) as UserProfile)
    } catch (e) {
      console.error(`[UserProfileRepository] Failed to parse: ${e}`)
      return withNormalizedAvatar(DEFAULT_PROFILE)
    }
  }

  /**
   * 保存或更新完整的档案 JSON。
   */
  async saveProfile(profile: UserProfile): Promise<void> {
    const jsonStr = JSON.stringify(profile)

    await this.db
      .insert(systemSettingsTable)
      .values({
        key: KEY,
        value: jsonStr,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: systemSettingsTable.key,
        set: {
          value: jsonStr,
          updatedAt: new Date()
        }
      })
  }
}
