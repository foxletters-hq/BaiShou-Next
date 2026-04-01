import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { summariesTable } from '../schema/summaries';
import { agentSessionsTable } from '../schema/agent-sessions';
import { FTS_INIT_SQL } from '../schema/fts';

describe('Database Schema', () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    
    // 简易建表逻辑用于测试
    sqlite.exec(`
      CREATE TABLE summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_type TEXT NOT NULL,
        target_date INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);
  });

  it('should execute schema successfully', async () => {
    const result = await db.select().from(summariesTable);
    expect(result).toBeDefined();
  });
});
