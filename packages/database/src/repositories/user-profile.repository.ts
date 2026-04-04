import { eq } from 'drizzle-orm';
import { systemSettingsTable } from '../schema/system-settings';
import type { UserProfile } from '@baishou/shared';

const KEY = 'user_profile_data';

export const DEFAULT_PROFILE: UserProfile = {
  nickname: '白守用户', // t.settings.default_nickname
  avatarPath: null,
  activePersonaId: '默认身份卡', // t.settings.default_identity
  personas: {
    '默认身份卡': {
      id: '默认身份卡',
      facts: {}
    }
  }
};

export class UserProfileRepository {
  public readonly table = systemSettingsTable; // exposed for tests if needed

  constructor(private readonly db: any) {}

  /**
   * 获取用户档案聚合 JSON。
   */
  async getProfile(): Promise<UserProfile> {
    const result = await this.db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, KEY))
      .limit(1);

    if (result.length === 0) {
      return DEFAULT_PROFILE;
    }

    try {
      return JSON.parse(result[0].value) as UserProfile;
    } catch (e) {
      console.error(`[UserProfileRepository] Failed to parse: ${e}`);
      return DEFAULT_PROFILE;
    }
  }

  /**
   * 保存或更新完整的档案 JSON。
   */
  async saveProfile(profile: UserProfile): Promise<void> {
    const jsonStr = JSON.stringify(profile);
    
    await this.db.insert(systemSettingsTable)
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
      });
  }
}
