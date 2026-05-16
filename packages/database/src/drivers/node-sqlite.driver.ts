import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as path from 'path';
import * as fs from 'fs';
import { AppDatabase } from '../types';
import { MigrationService } from '../migration.service';

/**
 * 初始化适用于 Desktop / Node 端的 SQLite 数据库实例
 * @param dbPath SQLite 文件路径 (例如 userData 目录下的 'baishou.db')
 * @returns 实例化的 Drizzle AppDatabase
 */
export function initNodeDatabase(dbPath: string): AppDatabase {
  const sqlite = createClient({ url: `file:${dbPath}` });
  
  // 注意：此处不再执行异步的 sqlite.execute PRAGMA，
  // 所有的 PRAGMA 配置已移至异步的 installDatabaseSchema 确保严格时序

  // Any automatic migrations can be added here if needed, 
  // currently we return the drizzle instance.
  
  const db = drizzle(sqlite) as unknown as AppDatabase;
  return db;
}

export async function installDatabaseSchema(db: AppDatabase): Promise<void> {
  const internalDb = db as any;
  const client: Client = internalDb.session?.client;
  
  if (!client) {
    console.warn('[DB] No valid LibSQL client found to execute migrations!');
    return;
  }

  // PRAGMA 必须在所有读写之前 await 执行（不能放在同步构造器里），
  // 这是防止初始化竞态条件的关键。WAL 模式在单写场景下性能最佳，
  // 原 SQLITE_CORRUPT 的根因是 DB 被初始化到错误路径，与 WAL 无关。
  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA synchronous = NORMAL');
  await client.execute('PRAGMA foreign_keys = ON');

  // Derive the migrations directory depending on dev or prod
  const isDev = process.env.NODE_ENV !== 'production' && !process.env.VITE_APP_BUILD;
  let migrationDir = '';
  
  if (isDev) {
    // During dev, process.cwd() could be either root or apps/desktop
    if (fs.existsSync(path.join(process.cwd(), 'apps', 'desktop', 'resources', 'database', 'drizzle'))) {
      migrationDir = path.join(process.cwd(), 'apps', 'desktop', 'resources', 'database', 'drizzle');
    } else {
      migrationDir = path.join(process.cwd(), 'resources', 'database', 'drizzle');
    }
  } else {
    // In production, app.asar.unpacked/resources handles it
    migrationDir = path.join(process.resourcesPath || process.cwd(), 'database', 'drizzle');
  }

  const migrationService = new MigrationService(db, client, migrationDir);
  await migrationService.runMigrations();
}

