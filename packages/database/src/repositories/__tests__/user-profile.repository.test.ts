import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { UserProfileRepository, DEFAULT_PROFILE } from '../user-profile.repository';

describe('UserProfileRepository', () => {
  let db: any;
  let repo: UserProfileRepository;

  beforeEach(() => {
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    
    // 初始化所需表结构
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    repo = new UserProfileRepository(db);
  });

  it('should return default profile when db has no records', async () => {
    const profile = await repo.getProfile();
    expect(profile).toEqual(DEFAULT_PROFILE);
    expect(profile.activePersonaId).toBe('默认身份卡');
    expect(profile.personas['默认身份卡']).toBeDefined();
  });

  it('should save and correctly fetch updated profile', async () => {
    const mockProfile = {
      ...DEFAULT_PROFILE,
      nickname: '测试用户',
      activePersonaId: '黑客',
      personas: {
        '黑客': { id: '黑客', facts: { '职业': '赛博黑客' } }
      }
    };

    await repo.saveProfile(mockProfile);

    const retrieved = await repo.getProfile();
    expect(retrieved.nickname).toBe('测试用户');
    expect(retrieved.activePersonaId).toBe('黑客');
    expect(retrieved.personas['黑客'].facts['职业']).toBe('赛博黑客');
  });

  it('should gracefully handle bad json', async () => {
    await db.insert((repo as any).table).values({
      key: 'user_profile_data',
      value: '{badjson}',
      updatedAt: new Date()
    });

    const profile = await repo.getProfile();
    expect(profile.nickname).toBe(DEFAULT_PROFILE.nickname); // rollback to default
  });
});
