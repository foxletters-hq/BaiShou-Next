import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { diariesTable } from '../schema/diaries';

describe('Database Schema', () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    
    // 简易建表逻辑用于测试
    sqlite.exec(`
      CREATE TABLE diaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date INTEGER NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);
  });

  it('should insert and fetch a diary', async () => {
    const now = new Date();
    await db.insert(diariesTable).values({
      date: now,
      content: 'Database test content',
      tags: 'test'
    });

    const result = await db.select().from(diariesTable);
    expect(result.length).toBe(1);
    expect(result[0]!.content).toBe('Database test content');
    expect(result[0]!.date).toBeInstanceOf(Date);
  });
});
