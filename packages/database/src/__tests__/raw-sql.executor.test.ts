import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { executeRawSql } from '../raw-sql.executor';

describe('executeRawSql (better-sqlite3)', () => {
  it('runs PRAGMA table_info and parameterized UPDATE', async () => {
    const db = new Database(':memory:');
    await executeRawSql(db, 'CREATE TABLE t (id TEXT PRIMARY KEY, v TEXT)');
    await executeRawSql(db, 'INSERT INTO t (id, v) VALUES (?, ?)', ['a', 'old']);
    const info = await executeRawSql(db, "PRAGMA main.table_info('t')");
    expect(info.rows.map((r: any) => r.name)).toEqual(['id', 'v']);
    await executeRawSql(db, 'UPDATE t SET v = ? WHERE id = ?', ['new', 'a']);
    const rows = await executeRawSql(db, 'SELECT v FROM t WHERE id = ?', ['a']);
    expect(rows.rows[0]?.v).toBe('new');
    db.close();
  });
});
