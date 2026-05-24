import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import * as path from 'path'
import * as fs from 'fs'
import { AppDatabase } from '../types'
import { MigrationService } from '../migration.service'

/**
 * 初始化适用于 Desktop / Node 端的 SQLite 数据库实例
 * @param dbPath SQLite 文件路径 (例如 userData 目录下的 'baishou.db')
 * @returns 实例化的 Drizzle AppDatabase
 */
export function initNodeDatabase(dbPath: string, onCorrupt?: (err: any) => void): AppDatabase {
  const sqlite = new Database(dbPath)

  // 1. 一键载入 C++ 原生向量数据库引擎支持！
  try {
    sqliteVec.load(sqlite)
    console.log(
      '[VectorSearch] Native sqlite-vec extension loaded successfully on desktop database!'
    )
  } catch (e: any) {
    console.error('[VectorSearch] Failed to load native sqlite-vec extension:', e.message)
  }

  // 2. 将 WAL 模式与 Pragma 在最稳固的数据库打开时序中同步设置
  try {
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('synchronous = NORMAL')
    sqlite.pragma('foreign_keys = ON')
  } catch (e: any) {
    console.warn('[DB] Failed to apply database pragmas synchronously:', e.message)
  }

  // 3. 用 proxy 代理底层实例，捕获运行时的 malformed/corrupt 报错
  const wrappedSqlite = onCorrupt ? wrapSqlite(sqlite, onCorrupt) : sqlite

  // 4. 用 drizzle ORM 包装 wrappedSqlite 实例
  const db = drizzle(wrappedSqlite) as unknown as AppDatabase
  return db
}

/**
 * 包装 better-sqlite3 实例以捕获 malformed/SQLITE_CORRUPT 异常并触发回调
 */
function wrapSqlite(sqlite: Database.Database, onCorrupt: (err: any) => void): Database.Database {
  const handleErr = (err: any) => {
    if (
      err &&
      (err.code === 'SQLITE_CORRUPT' ||
        err.message?.includes('malformed') ||
        err.message?.includes('database disk image is malformed'))
    ) {
      onCorrupt(err)
    }
  }

  const wrapStatement = (stmt: Database.Statement): Database.Statement => {
    return new Proxy(stmt, {
      get(target, prop, receiver) {
        const val = Reflect.get(target, prop, receiver)
        if (typeof val === 'function') {
          return function (this: any, ...args: any[]) {
            try {
              return val.apply(target, args)
            } catch (err: any) {
              handleErr(err)
              throw err
            }
          }
        }
        return val
      }
    }) as unknown as Database.Statement
  }

  return new Proxy(sqlite, {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver)
      if (typeof val === 'function') {
        if (prop === 'prepare') {
          return function (this: any, ...args: any[]) {
            try {
              const stmt = val.apply(target, args)
              return wrapStatement(stmt)
            } catch (err: any) {
              handleErr(err)
              throw err
            }
          }
        }
        return function (this: any, ...args: any[]) {
          try {
            return val.apply(target, args)
          } catch (err: any) {
            handleErr(err)
            throw err
          }
        }
      }
      return val
    }
  })
}

export async function installDatabaseSchema(db: AppDatabase): Promise<void> {
  const internalDb = db as any
  const client = internalDb.session?.client

  if (!client) {
    console.warn('[DB] No valid Better-SQLite3 client found to execute migrations!')
    return
  }

  // Derive the migrations directory depending on dev or prod
  const isDev = process.env.NODE_ENV !== 'production' && !process.env.VITE_APP_BUILD
  let migrationDir = ''

  if (isDev) {
    // During dev, process.cwd() could be either root or apps/desktop
    if (
      fs.existsSync(path.join(process.cwd(), 'apps', 'desktop', 'resources', 'database', 'drizzle'))
    ) {
      migrationDir = path.join(process.cwd(), 'apps', 'desktop', 'resources', 'database', 'drizzle')
    } else {
      migrationDir = path.join(process.cwd(), 'resources', 'database', 'drizzle')
    }
  } else {
    // In production, app.asar.unpacked/resources handles it
    migrationDir = path.join((process as any).resourcesPath || process.cwd(), 'database', 'drizzle')
  }

  const migrationService = new MigrationService(db, client, migrationDir)
  await migrationService.runMigrations()
}
