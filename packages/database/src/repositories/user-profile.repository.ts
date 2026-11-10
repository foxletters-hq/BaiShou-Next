import { eq } from 'drizzle-orm'
import { systemSettingsTable } from '../schema/system-settings'
import { withExpoAgentDatabaseLock } from '../expo-agent-db.lock'
import { runWithSqliteBusyRetry } from '../sqlite-busy.util'
import {
  USER_DEFAULT_AVATAR_SENTINEL,
  isCustomUserAvatar,
  isBuiltinUserAvatarPath,
  DEFAULT_USER_PROFILE,
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  USER_PROFILE_SETTINGS_KEY,
  alignVaultProfileLegacyKey,
  ensureVaultProfilesInitialized,
  mergeVaultIdentityIntoUserProfile,
  resolveUserProfileForVault,
  type UserProfile
} from '@baishou/shared'

const KEY = USER_PROFILE_SETTINGS_KEY

function withNormalizedAvatar(profile: UserProfile): UserProfile {
  if (isCustomUserAvatar(profile.avatarPath) || isBuiltinUserAvatarPath(profile.avatarPath))
    return profile
  return { ...profile, avatarPath: USER_DEFAULT_AVATAR_SENTINEL }
}

export const DEFAULT_PROFILE = DEFAULT_USER_PROFILE

export class UserProfileRepository {
  public readonly table = systemSettingsTable // exposed for tests if needed

  constructor(
    private readonly db: any,
    private readonly resolveVaultId?: () => string | undefined,
    private readonly resolveLegacyVaultId?: () => string | undefined,
    private readonly resolveAllVaultIds?: () => readonly string[] | undefined
  ) {}

  private run<T>(fn: () => Promise<T>): Promise<T> {
    return withExpoAgentDatabaseLock(this.db, () => runWithSqliteBusyRetry(fn))
  }

  private async readRawProfile(): Promise<UserProfile | null> {
    const result = await this.db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, KEY))
      .limit(1)

    if (result.length === 0) {
      return null
    }

    try {
      return JSON.parse(result[0].value) as UserProfile
    } catch (e) {
      console.error(`[UserProfileRepository] Failed to parse: ${e}`)
      return null
    }
  }

  private async readLegacyGraphConfiguredFlag(): Promise<boolean | null> {
    const result = await this.db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY))
      .limit(1)

    if (result.length === 0) {
      return null
    }

    try {
      return Boolean(JSON.parse(result[0].value))
    } catch {
      return null
    }
  }

  private async writeRawProfile(profile: UserProfile): Promise<void> {
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

  /**
   * 获取用户档案聚合 JSON（支持按小窝解析与旧数据首次向已有小窝迁移）。
   */
  async getProfile(vaultId?: string): Promise<UserProfile> {
    return this.run(async () => {
      const targetVaultId = vaultId?.trim() || this.resolveVaultId?.()?.trim() || ''
      const legacyVaultId = this.resolveLegacyVaultId?.()?.trim() || ''
      const knownVaultIds = this.resolveAllVaultIds?.()
      const raw = await this.readRawProfile()

      if (!raw) {
        return withNormalizedAvatar(
          resolveUserProfileForVault(DEFAULT_PROFILE, targetVaultId, legacyVaultId)
        )
      }

      if (!targetVaultId) {
        return withNormalizedAvatar(raw)
      }

      let current = raw
      let dirty = false

      if (current.vaultProfiles === undefined) {
        const legacyFlag = await this.readLegacyGraphConfiguredFlag()
        const { profile: initialized, migrated } = ensureVaultProfilesInitialized(
          current,
          targetVaultId,
          legacyFlag,
          knownVaultIds
        )
        current = initialized
        dirty = dirty || migrated
      }

      const { profile: aligned, aligned: didAlign } = alignVaultProfileLegacyKey(
        current,
        targetVaultId,
        legacyVaultId
      )
      current = aligned
      dirty = dirty || didAlign

      if (dirty) {
        await this.writeRawProfile(current)
      }

      return withNormalizedAvatar(resolveUserProfileForVault(current, targetVaultId, legacyVaultId))
    })
  }

  /**
   * 保存或更新档案 JSON（存在 vaultId 时只修改该小窝的个人身份字段并同步全局字段）。
   */
  async saveProfile(profile: UserProfile, vaultId?: string): Promise<void> {
    return this.run(async () => {
      const targetVaultId = vaultId?.trim() || this.resolveVaultId?.()?.trim() || ''
      const legacyVaultId = this.resolveLegacyVaultId?.()?.trim() || ''
      const knownVaultIds = this.resolveAllVaultIds?.()

      if (!targetVaultId) {
        await this.writeRawProfile(profile)
        return
      }

      const existingRaw = await this.readRawProfile()
      const legacyFlag =
        existingRaw?.vaultProfiles === undefined ? await this.readLegacyGraphConfiguredFlag() : null

      const merged = mergeVaultIdentityIntoUserProfile(existingRaw, profile, targetVaultId, {
        legacyVaultId,
        legacyGraphConfiguredFlag: legacyFlag,
        knownVaultIds
      })
      await this.writeRawProfile(merged)
    })
  }
}
