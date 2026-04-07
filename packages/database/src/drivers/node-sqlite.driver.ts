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
  
  // Enforce foreign key constraints
  sqlite.execute('PRAGMA journal_mode = WAL');
  sqlite.execute('PRAGMA foreign_keys = ON');

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

