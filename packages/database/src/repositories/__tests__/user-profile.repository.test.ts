import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { UserProfileRepository, DEFAULT_PROFILE } from '../user-profile.repository'

describe('UserProfileRepository', () => {
  let client: Client
  let db: any
  let repo: UserProfileRepository

  beforeEach(async () => {
    client = createClient({ url: ':memory:' })
    db = drizzle(client)

    // 初始化所需表结构
    await client.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)

    repo = new UserProfileRepository(db)
  })

  afterEach(() => {
    client.close()
  })

  it('should return default profile when db has no records', async () => {
    const profile = await repo.getProfile()
    expect(profile).toEqual(DEFAULT_PROFILE)
    expect(profile.activePersonaId).toBe('默认身份卡')
    expect(profile.personas['默认身份卡']).toBeDefined()
  })

  it('should save and correctly fetch updated profile', async () => {
    const mockProfile = {
      ...DEFAULT_PROFILE,
      nickname: '测试用户',
      activePersonaId: '黑客',
      personas: {
        黑客: { id: '黑客', facts: { 职业: '赛博黑客' } }
      }
    }

    await repo.saveProfile(mockProfile)

    const retrieved = await repo.getProfile()
    expect(retrieved.nickname).toBe('测试用户')
    expect(retrieved.activePersonaId).toBe('黑客')
    expect(retrieved.personas['黑客']!.facts['职业']).toBe('赛博黑客')
  })

  it('should preserve builtin avatar paths on retrieval', async () => {
    const mockProfile = {
      ...DEFAULT_PROFILE,
      avatarPath: 'builtin-user:user-preset-6'
    }

    await repo.saveProfile(mockProfile)
    const retrieved = await repo.getProfile()
    expect(retrieved.avatarPath).toBe('builtin-user:user-preset-6')
  })

  it('should gracefully handle bad json', async () => {
    await db.insert((repo as any).table).values({
      key: 'user_profile_data',
      value: '{badjson}',
      updatedAt: new Date()
    })

    const profile = await repo.getProfile()
    expect(profile.nickname).toBe(DEFAULT_PROFILE.nickname) // rollback to default
  })

  it('should isolate personal identity per vault while sharing global fields across vaults', async () => {
    let activeVaultId = 'vlt_1'
    const vaultRepo = new UserProfileRepository(db, () => activeVaultId)

    await vaultRepo.saveProfile({
      ...DEFAULT_PROFILE,
      nickname: '小窝一主人',
      birthday: '1998-03-15',
      gender: 'female',
      avatarPath: 'builtin-user:user-preset-1'
    })

    activeVaultId = 'vlt_2'
    const unawakenedVault2 = await vaultRepo.getProfile()
    expect(unawakenedVault2.nickname).toBe('用户')
    expect(unawakenedVault2.birthday).toBeNull()
    expect(unawakenedVault2.gender).toBeNull()
    expect(unawakenedVault2.avatarPath).toBe('builtin-user:user-preset-1')

    await vaultRepo.saveProfile({
      ...unawakenedVault2,
      nickname: '小窝二主人',
      birthday: '2001-08-08',
      gender: 'male',
      avatarPath: 'builtin-user:user-preset-2'
    })

    const vault2Profile = await vaultRepo.getProfile()
    expect(vault2Profile.nickname).toBe('小窝二主人')
    expect(vault2Profile.birthday).toBe('2001-08-08')
    expect(vault2Profile.gender).toBe('male')
    expect(vault2Profile.avatarPath).toBe('builtin-user:user-preset-2')

    activeVaultId = 'vlt_1'
    const vault1Profile = await vaultRepo.getProfile()
    expect(vault1Profile.nickname).toBe('小窝一主人')
    expect(vault1Profile.birthday).toBe('1998-03-15')
    expect(vault1Profile.gender).toBe('female')
    expect(vault1Profile.avatarPath).toBe('builtin-user:user-preset-2')
  })

  it('should migrate legacy pre-vaultProfiles record to all existing vaults and allow independent modification while keeping newly created vaults unawakened', async () => {
    // 先写入旧版无 vaultProfiles 的记录
    await repo.saveProfile({
      ...DEFAULT_PROFILE,
      nickname: '历史昵称',
      birthday: '1995-10-10',
      gender: 'male'
    })

    let activeVaultId = 'vlt_primary'
    const existingVaultIds = ['vlt_primary', 'vlt_other_existing']
    const vaultRepo = new UserProfileRepository(
      db,
      () => activeVaultId,
      undefined,
      () => existingVaultIds
    )

    const primaryProfile = await vaultRepo.getProfile()
    expect(primaryProfile.nickname).toBe('历史昵称')
    expect(primaryProfile.birthday).toBe('1995-10-10')
    expect(primaryProfile.gender).toBe('male')

    // 切换到另一个已有小窝，保留旧个人信息并可独立修改
    activeVaultId = 'vlt_other_existing'
    const otherExistingProfile = await vaultRepo.getProfile()
    expect(otherExistingProfile.nickname).toBe('历史昵称')
    expect(otherExistingProfile.birthday).toBe('1995-10-10')
    expect(otherExistingProfile.gender).toBe('male')

    await vaultRepo.saveProfile({
      ...otherExistingProfile,
      nickname: '改后昵称'
    })
    expect((await vaultRepo.getProfile()).nickname).toBe('改后昵称')

    // 原小窝保持不变
    activeVaultId = 'vlt_primary'
    expect((await vaultRepo.getProfile()).nickname).toBe('历史昵称')

    // 之后新建的小窝为默认未唤醒状态
    existingVaultIds.push('vlt_newly_created')
    activeVaultId = 'vlt_newly_created'
    const newVaultProfile = await vaultRepo.getProfile()
    expect(newVaultProfile.nickname).toBe('用户')
    expect(newVaultProfile.birthday).toBeNull()
    expect(newVaultProfile.gender).toBeNull()
  })
})
