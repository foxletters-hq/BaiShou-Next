import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { AppDatabase } from '../types';

/**
 * 初始化适用于 Desktop / Node 端的 SQLite 数据库实例
 * @param dbPath SQLite 文件路径 (例如 userData 目录下的 'baishou.db')
 * @returns 实例化的 Drizzle AppDatabase
 */
export function initNodeDatabase(dbPath: string): AppDatabase {
  const sqlite = new Database(dbPath);
  
  // Enforce foreign key constraints
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Any automatic migrations can be added here if needed, 
  // currently we return the drizzle instance.
  
  const db = drizzle(sqlite) as unknown as AppDatabase;
  return db;
}
