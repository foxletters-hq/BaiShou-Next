import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { PromptShortcutRepository, DEFAULT_SHORTCUTS } from '../prompt-shortcut.repository';

describe('PromptShortcutRepository', () => {
  let db: any;
  let repo: PromptShortcutRepository;

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

    repo = new PromptShortcutRepository(db);
  });

  it('should return default shortcuts when db has no records', async () => {
    const shortcuts = await repo.getShortcuts();
    expect(shortcuts).toEqual(DEFAULT_SHORTCUTS);
  });

  it('should correctly save and fetch custom shortcuts', async () => {
    const mockList = [
      { id: 'custom-1', icon: '🤖', name: '测试', content: '测试内容' }
    ];

    await repo.saveShortcuts(mockList);

    const retrieved = await repo.getShortcuts();
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].name).toBe('测试');
  });

  it('should overwrite existing array on save', async () => {
    await repo.saveShortcuts([
      { id: 'a', icon: 'a', name: 'a', content: 'a' }
    ]);
    await repo.saveShortcuts([
      { id: 'b', icon: 'b', name: 'b', content: 'b' }
    ]);

    const retrieved = await repo.getShortcuts();
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].id).toBe('b');
  });
});
