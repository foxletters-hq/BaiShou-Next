import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { SettingsRepository } from '../settings.repository';
import { systemSettingsTable } from '../../schema/system-settings';

describe('SettingsRepository', () => {
  let db: any;
  let repo: SettingsRepository;

  beforeEach(() => {
    // 采用内存数据库进行极其干净快速的 TDD 测试
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    
    // 初始化独立表结构
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    repo = new SettingsRepository(db);
  });

  it('should return null for non-existent key', async () => {
    const value = await repo.get('not-exist');
    expect(value).toBeNull();
  });

  it('should save and correctly retrieve complex JSON objects', async () => {
    const mockProviders = [
      { id: 'openai', apiKey: 'sk-123', isEnabled: true },
      { id: 'gemini', apiKey: 'ai-321', isEnabled: false }
    ];

    await repo.set('ai_providers', mockProviders);

    const retrieved = await repo.get<typeof mockProviders>('ai_providers');
    
    expect(retrieved).not.toBeNull();
    expect(retrieved?.length).toBe(2);
    expect(retrieved?.[0].id).toBe('openai');
    expect(retrieved?.[0].apiKey).toBe('sk-123');
    expect(retrieved?.[0].isEnabled).toBe(true);
  });

  it('should upsert existing key instead of throwing duplication error', async () => {
    const initialConfig = { theme: 'dark' };
    await repo.set('app_config', initialConfig);
    
    const updatedConfig = { theme: 'light' };
    await repo.set('app_config', updatedConfig);
    
    const retrieved = await repo.get<typeof initialConfig>('app_config');
    expect(retrieved?.theme).toBe('light');
  });

  it('should delete keys successfully', async () => {
    await repo.set('temp_key', { a: 1 });
    await repo.delete('temp_key');
    const retrieved = await repo.get('temp_key');
    expect(retrieved).toBeNull();
  });

  it('should handle JSON parse errors gracefully and return null', async () => {
    // 直接模拟注入坏死的非 JSON 数据
    await db.insert(systemSettingsTable).values({
      key: 'corrupted',
      value: '{bad_json',
      updatedAt: new Date()
    });

    const value = await repo.get('corrupted');
    expect(value).toBeNull();
  });
});
