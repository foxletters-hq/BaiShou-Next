import { describe, expect, it } from 'vitest'
import {
  getUserProfileFromSettings,
  getVaultGraphSelfNameConfigured,
  migrateUserProfileSettingsKey,
  saveUserProfileToSettings,
  setVaultGraphSelfNameConfigured,
  type UserProfileSettingsStore
} from '../user-profile-settings.util'
import { GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY } from '../../constants/graph-self-name.constants'
import {
  DEFAULT_USER_PROFILE,
  USER_PROFILE_LEGACY_SETTINGS_KEY,
  USER_PROFILE_SETTINGS_KEY
} from '../../constants/user-profile.constants'
import type { UserProfile } from '../../types/user-profile.types'

function createMemoryStore(
  initial: Record<string, unknown> = {},
  options?: {
    getActiveVaultId?: () => string | undefined
    getActiveLegacyVaultId?: () => string | undefined
    getAllVaultIds?: () => readonly string[] | undefined
  }
): UserProfileSettingsStore {
  const map = new Map<string, unknown>(Object.entries(initial))
  return {
    get: async <T>(key: string) => (map.has(key) ? (map.get(key) as T) : null),
    set: async <T>(key: string, value: T) => {
      map.set(key, value)
    },
    delete: async (key: string) => {
      map.delete(key)
    },
    getActiveVaultId: options?.getActiveVaultId,
    getActiveLegacyVaultId: options?.getActiveLegacyVaultId,
    getAllVaultIds: options?.getAllVaultIds
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

describe('vault-scoped user profile & graph awaken state', () => {
  it('migrates legacy global profile to all existing vaults so each retains old info and can be modified independently, while newly created vaults remain unawakened', async () => {
    let activeVaultId = 'vlt_main'
    const existingVaultIds = ['vlt_main', 'vlt_second']
    const legacyGlobalProfile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      nickname: '小旅人',
      birthday: '1999-05-20',
      gender: 'female',
      showIdentityInProfile: false,
      shareIdentityWithCompanion: true,
      avatarPath: 'builtin://1'
    }

    const store = createMemoryStore(
      {
        [USER_PROFILE_SETTINGS_KEY]: legacyGlobalProfile,
        [GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY]: true
      },
      {
        getActiveVaultId: () => activeVaultId,
        getAllVaultIds: () => existingVaultIds
      }
    )

    // 首次在 vlt_main 读取，触发向所有已有小窝（vlt_main、vlt_second）的旧数据迁移
    const mainProfile = await getUserProfileFromSettings(store)
    expect(mainProfile.nickname).toBe('小旅人')
    expect(mainProfile.birthday).toBe('1999-05-20')
    expect(mainProfile.gender).toBe('female')
    expect(mainProfile.showIdentityInProfile).toBe(false)
    expect(mainProfile.avatarPath).toBe('builtin://1')
    expect(await getVaultGraphSelfNameConfigured(store)).toBe(true)

    // 切换到另一个已有小窝 vlt_second，保留旧的个人信息与已唤醒状态，并允许独立修改
    activeVaultId = 'vlt_second'
    const secondProfile = await getUserProfileFromSettings(store)
    expect(secondProfile.nickname).toBe('小旅人')
    expect(secondProfile.birthday).toBe('1999-05-20')
    expect(secondProfile.gender).toBe('female')
    expect(secondProfile.showIdentityInProfile).toBe(false)
    expect(await getVaultGraphSelfNameConfigured(store)).toBe(true)

    await saveUserProfileToSettings(store, {
      ...secondProfile,
      nickname: '二窝新自称',
      birthday: '2001-11-11'
    })
    const updatedSecond = await getUserProfileFromSettings(store)
    expect(updatedSecond.nickname).toBe('二窝新自称')
    expect(updatedSecond.birthday).toBe('2001-11-11')

    // 切回 vlt_main，不受 vlt_second 修改影响
    activeVaultId = 'vlt_main'
    const mainAfterSecondEdit = await getUserProfileFromSettings(store)
    expect(mainAfterSecondEdit.nickname).toBe('小旅人')
    expect(mainAfterSecondEdit.birthday).toBe('1999-05-20')

    // 后续新建小窝 vlt_new_created，应为未唤醒默认状态
    existingVaultIds.push('vlt_new_created')
    activeVaultId = 'vlt_new_created'
    const newVaultProfile = await getUserProfileFromSettings(store)
    expect(newVaultProfile.nickname).toBe('用户')
    expect(newVaultProfile.birthday).toBeNull()
    expect(newVaultProfile.gender).toBeNull()
    expect(newVaultProfile.showIdentityInProfile).toBe(true)
    expect(newVaultProfile.avatarPath).toBe('builtin://1')
    expect(await getVaultGraphSelfNameConfigured(store)).toBe(false)
  })

  it('waits for vault registry to finish loading before persisting legacy migration so other existing vaults are not missed', async () => {
    let activeVaultId = 'vlt_main'
    let registryVaultIds: string[] = []
    const store = createMemoryStore(
      {
        [USER_PROFILE_SETTINGS_KEY]: {
          ...DEFAULT_USER_PROFILE,
          nickname: '老用户',
          birthday: '1996-06-06',
          gender: 'male'
        },
        [GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY]: true
      },
      {
        getActiveVaultId: () => activeVaultId,
        getAllVaultIds: () => registryVaultIds
      }
    )

    // 注册表尚未就绪（返回 []）时的早期读取：内存可正常返回旧身份，但不提前落盘锁定
    const earlyRead = await getUserProfileFromSettings(store)
    expect(earlyRead.nickname).toBe('老用户')

    // 注册表加载完成，包含两个已有小窝
    registryVaultIds = ['vlt_main', 'vlt_other_existing']
    await getUserProfileFromSettings(store)

    activeVaultId = 'vlt_other_existing'
    const otherExisting = await getUserProfileFromSettings(store)
    expect(otherExisting.nickname).toBe('老用户')
    expect(otherExisting.birthday).toBe('1996-06-06')
    expect(otherExisting.gender).toBe('male')
    expect(await getVaultGraphSelfNameConfigured(store)).toBe(true)
  })

  it('isolates personal identity per vault while sharing global avatar, background, and personas', async () => {
    let activeVaultId = 'vlt_a'
    const store = createMemoryStore(
      { [USER_PROFILE_SETTINGS_KEY]: { ...DEFAULT_USER_PROFILE } },
      { getActiveVaultId: () => activeVaultId }
    )

    // 在 vlt_a 保存个人身份
    await saveUserProfileToSettings(store, {
      ...DEFAULT_USER_PROFILE,
      nickname: 'A窝主人',
      birthday: '2000-01-01',
      gender: 'male',
      avatarPath: 'builtin://a'
    })
    await setVaultGraphSelfNameConfigured(store, true)

    // 切换到 vlt_b，保存不同个人身份并更新全局背景与身份卡
    activeVaultId = 'vlt_b'
    await saveUserProfileToSettings(store, {
      ...DEFAULT_USER_PROFILE,
      nickname: 'B窝访客',
      birthday: '2002-12-12',
      gender: 'other',
      customGender: '赛博朋克',
      showIdentityInProfile: false,
      shareIdentityWithCompanion: false,
      avatarPath: 'builtin://shared',
      chatBackgroundPath: 'backgrounds/bg.jpg',
      activePersonaId: '学习',
      personas: {
        ...DEFAULT_USER_PROFILE.personas,
        学习: { id: '学习', facts: { 目标: '考研' } }
      }
    })
    await setVaultGraphSelfNameConfigured(store, true)

    const profileB = await getUserProfileFromSettings(store)
    expect(profileB.nickname).toBe('B窝访客')
    expect(profileB.birthday).toBe('2002-12-12')
    expect(profileB.gender).toBe('other')
    expect(profileB.customGender).toBe('赛博朋克')
    expect(profileB.showIdentityInProfile).toBe(false)
    expect(profileB.shareIdentityWithCompanion).toBe(false)

    // 切回 vlt_a，个人身份保持 vlt_a 独立值，全局头像、背景、身份卡已同步更新
    activeVaultId = 'vlt_a'
    const profileA = await getUserProfileFromSettings(store)
    expect(profileA.nickname).toBe('A窝主人')
    expect(profileA.birthday).toBe('2000-01-01')
    expect(profileA.gender).toBe('male')
    expect(profileA.customGender).toBeNull()
    expect(profileA.showIdentityInProfile).toBe(true)
    expect(profileA.shareIdentityWithCompanion).toBe(true)
    expect(profileA.avatarPath).toBe('builtin://shared')
    expect(profileA.chatBackgroundPath).toBe('backgrounds/bg.jpg')
    expect(profileA.activePersonaId).toBe('学习')
    expect(profileA.personas['学习']?.facts).toEqual({ 目标: '考研' })
  })

  it('keeps an unawakened vault unawakened when only global fields (avatar/background/personas) are saved', async () => {
    const activeVaultId = 'vlt_unawakened'
    const store = createMemoryStore(
      { [USER_PROFILE_SETTINGS_KEY]: { ...DEFAULT_USER_PROFILE } },
      { getActiveVaultId: () => activeVaultId }
    )

    const current = await getUserProfileFromSettings(store)
    await saveUserProfileToSettings(store, {
      ...current,
      avatarPath: 'builtin://new-avatar',
      chatBackgroundBlur: 12
    })

    expect(await getVaultGraphSelfNameConfigured(store)).toBe(false)
    const reloaded = await getUserProfileFromSettings(store)
    expect(reloaded.nickname).toBe('用户')
    expect(reloaded.avatarPath).toBe('builtin://new-avatar')
    expect(reloaded.chatBackgroundBlur).toBe(12)
  })

  it('aligns pre-registry deterministic legacy vaultId to newly assigned vlt_ id', async () => {
    let activeVaultId = 'vault_d41d8cd98f00'
    const legacyVaultId = 'vault_d41d8cd98f00'
    const store = createMemoryStore(
      {},
      {
        getActiveVaultId: () => activeVaultId,
        getActiveLegacyVaultId: () => legacyVaultId
      }
    )

    // 注册表初始化前（如引导页）以确定性旧 ID 保存昵称
    await saveUserProfileToSettings(store, {
      ...DEFAULT_USER_PROFILE,
      nickname: '引导昵称'
    })
    await setVaultGraphSelfNameConfigured(store, true)

    // 注册表初始化后分配了正式 vlt_ 编号
    activeVaultId = 'vlt_1710000_abc'
    const alignedProfile = await getUserProfileFromSettings(store)
    expect(alignedProfile.nickname).toBe('引导昵称')
    expect(await getVaultGraphSelfNameConfigured(store)).toBe(true)

    const rawStored = await store.get<UserProfile>(USER_PROFILE_SETTINGS_KEY)
    expect(rawStored?.vaultProfiles?.['vlt_1710000_abc']?.nickname).toBe('引导昵称')
    expect(rawStored?.vaultProfiles?.[legacyVaultId]).toBeUndefined()
  })
})
