import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { summariesTable } from '../schema/summaries';
import { agentSessionsTable } from '../schema/agent-sessions';

describe('Database Schema', () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);

    // 建表 SQL 匹配真实 Drizzle schema
    sqlite.exec(`
      CREATE TABLE summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        start_date INTEGER NOT NULL,
        end_date INTEGER NOT NULL,
        content TEXT NOT NULL,
        source_ids TEXT,
        generated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        UNIQUE(type, start_date, end_date)
      );
    `);
  });

  it('should execute schema query successfully', async () => {
    const result = await db.select().from(summariesTable);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});
