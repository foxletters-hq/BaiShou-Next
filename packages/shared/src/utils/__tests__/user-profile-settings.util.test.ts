import { describe, expect, it } from 'vitest'
import {
  migrateUserProfileSettingsKey,
  type UserProfileSettingsStore
} from '../user-profile-settings.util'
import {
  USER_PROFILE_LEGACY_SETTINGS_KEY,
  USER_PROFILE_SETTINGS_KEY
} from '../../constants/user-profile.constants'
import type { UserProfile } from '../../types/user-profile.types'

function createMemoryStore(initial: Record<string, unknown> = {}): UserProfileSettingsStore {
  const map = new Map<string, unknown>(Object.entries(initial))
  return {
    get: async <T>(key: string) => (map.has(key) ? (map.get(key) as T) : null),
    set: async <T>(key: string, value: T) => {
      map.set(key, value)
    },
    delete: async (key: string) => {
      map.delete(key)
    }
  }
}

const sampleProfile: UserProfile = {
  nickname: 'Alice',
  avatarPath: null,
  activePersonaId: '工作',
  personas: { 工作: { id: '工作', facts: { 职业: '工程师' } } }
}

describe('migrateUserProfileSettingsKey', () => {
  it('moves legacy key to canonical key', async () => {
    const store = createMemoryStore({ [USER_PROFILE_LEGACY_SETTINGS_KEY]: sampleProfile })
    const changed = await migrateUserProfileSettingsKey(store)

    expect(changed).toBe(true)
    expect(await store.get(USER_PROFILE_SETTINGS_KEY)).toEqual(sampleProfile)
    expect(await store.get(USER_PROFILE_LEGACY_SETTINGS_KEY)).toBeNull()
  })

  it('removes legacy key when canonical already exists', async () => {
    const store = createMemoryStore({
      [USER_PROFILE_SETTINGS_KEY]: sampleProfile,
      [USER_PROFILE_LEGACY_SETTINGS_KEY]: { ...sampleProfile, nickname: 'Old' }
    })
    const changed = await migrateUserProfileSettingsKey(store)

    expect(changed).toBe(true)
    expect(await store.get(USER_PROFILE_SETTINGS_KEY)).toEqual(sampleProfile)
    expect(await store.get(USER_PROFILE_LEGACY_SETTINGS_KEY)).toBeNull()
  })

  it('no-op when only canonical exists', async () => {
    const store = createMemoryStore({ [USER_PROFILE_SETTINGS_KEY]: sampleProfile })
    const changed = await migrateUserProfileSettingsKey(store)
    expect(changed).toBe(false)
  })
})
