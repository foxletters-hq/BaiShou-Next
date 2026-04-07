import { createClient, Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as path from 'path';
import * as fs from 'fs';

import type { AppDatabase } from './types';

/**
 * 影子索引连接管理器 (ShadowIndexConnectionManager)
 *
 * 像素级对齐原版 `ShadowIndexDatabase`（Dart/Drift 实现）的核心设计：
 *
 * 1. 每个 Vault 拥有一个独立的 `shadow_index.db` 文件
 *    路径：`<vault_path>/.baishou/shadow_index.db`
 * 2. 连接时自动执行建表（`CREATE TABLE IF NOT EXISTS`），确保表结构始终存在
 * 3. 崩溃恢复：若建表失败（文件损坏），删除文件并重新建库重建
 * 4. Vault 切换时关闭旧连接，建立新连接
 *
 * 表结构（对齐原版表名）：
 * - `journals_index`  — 主影子索引表（索引 .md 文件的元数据）
 * - `journals_fts`    — FTS5 全文搜索虚拟表（content + tags）
 */
export class ShadowIndexConnectionManager {
  private _client: Client | null = null;
  private _db: AppDatabase | null = null;
  private _currentDbPath: string | null = null;

  // ── 公开 API ─────────────────────────────────

  /**
   * 连接到指定 Vault 的影子索引数据库。
   *
   * @param vaultSystemDir Vault 的系统目录路径（即 `<vault>/.baishou`）
   */
  async connect(vaultSystemDir: string): Promise<void> {
    const dbPath = path.join(vaultSystemDir, 'shadow_index.db');

    // 如果是同一个路径且连接正常，复用旧连接
    if (this._currentDbPath === dbPath && this._client && this._db) {
      console.log(`[ShadowDB] 复用已有连接: ${dbPath}`);
      return;
    }

    // 关闭旧连接
    this._disconnect();

    console.log(`[ShadowDB] 正在连接影子索引库: ${dbPath}`);

    try {
      await this._initDatabase(dbPath);
    } catch (e: any) {
      // 崩溃恢复：文件损坏时删除并重建（对标原版 `_initDatabase` 的 catch & retry 逻辑）
      console.error(`[ShadowDB] 数据库初始化失败，尝试重建: ${e.message}`);
      this._disconnect();

      if (fs.existsSync(dbPath)) {
        console.warn(`[ShadowDB] 删除损坏的数据库文件: ${dbPath}`);
        fs.unlinkSync(dbPath);
      }

      // 最后一次尝试，若仍失败则向上抛出
      await this._initDatabase(dbPath);
    }

    console.log(`[ShadowDB] 影子索引库连接成功: ${dbPath}`);
  }

  /**
   * 返回当前 Vault 影子库的 Drizzle 数据库实例。
   * 若未连接则抛出异常。
   */
  getDb(): AppDatabase {
    if (!this._db) {
      throw new Error('[ShadowDB] 影子索引数据库尚未连接，请先调用 connect()');
    }
    return this._db;
  }

  /**
   * 返回当前 vault 影子库的原始 libsql Client（供需要裸 SQL 的场景使用）。
   */
  getClient(): Client {
    if (!this._client) {
      throw new Error('[ShadowDB] 影子索引数据库尚未连接，请先调用 connect()');
    }
    return this._client;
  }

  /**
   * 检查是否已建立连接
   */
  isConnected(): boolean {
    return this._client !== null && this._db !== null;
  }

  /**
   * 断开当前连接（通常在 Vault 切换前调用，内部 connect() 也会自动调用）。
   */
  disconnect(): void {
    this._disconnect();
  }

  // ── 内部方法 ─────────────────────────────────

  private async _initDatabase(dbPath: string): Promise<void> {
    // 确保父目录已存在
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const client = createClient({ url: `file:${dbPath}` });

    // WAL 模式：提升并发写入性能，对标原版 SQLite WAL 配置
    await client.execute('PRAGMA journal_mode=WAL');

    // 建表（幂等，始终 CREATE TABLE IF NOT EXISTS）
    await this._createTables(client);

    this._client = client;
    // Drizzle 包装（只用于 ShadowIndexRepository 的类型安全 ORM 操作）
    this._db = drizzle(client) as unknown as AppDatabase;
    this._currentDbPath = dbPath;
  }

  /**
   * 创建所有影子索引相关表（对标原版 `ShadowIndexDatabase._initDatabase()`）
   *
   * journals_index  — 主索引表
   * journals_fts    — FTS5 全文搜索虚拟表（含 fallback 普通表）
   */
  private async _createTables(client: Client): Promise<void> {
    // 主索引表（对齐原版 journals_index 表名与字段）
    await client.execute(`
      CREATE TABLE IF NOT EXISTS journals_index (
        id              INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        file_path       TEXT    NOT NULL,
        date            TEXT    NOT NULL,
        created_at      TEXT    NOT NULL,
        updated_at      TEXT    NOT NULL,
        content_hash    TEXT    NOT NULL,
        weather         TEXT,
        mood            TEXT,
        location        TEXT,
        location_detail TEXT,
        is_favorite     INTEGER NOT NULL DEFAULT 0,
        has_media       INTEGER NOT NULL DEFAULT 0,
        raw_content     TEXT,
        tags            TEXT
      )
    `);

    await client.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS journals_index_file_path_unique
      ON journals_index (file_path)
    `);

    // FTS5 全文搜索虚拟表（对齐原版 journals_fts 表名）
    // 若 SQLite 未编译 FTS5 则降级为普通表
    try {
      await client.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS journals_fts
        USING fts5(
          content,
          tags,
          tokenize = 'unicode61'
        )
      `);
      console.log('[ShadowDB] journals_fts FTS5 虚拟表创建成功');
    } catch (e: any) {
      console.warn('[ShadowDB] FTS5 不可用，降级为普通表:', e.message);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS journals_fts (
          rowid   INTEGER PRIMARY KEY,
          content TEXT,
          tags    TEXT
        )
      `);
    }
  }

  private _disconnect(): void {
    if (this._client) {
      this._client.close();
      this._client = null;
    }
    this._db = null;
    this._currentDbPath = null;
  }
}

/**
 * 全局影子索引连接管理器单例。
 *
 * 在 `vault.ipc.ts` 的 Vault 初始化/切换流程中调用 `shadowConnectionManager.connect(sysDir)`。
 * 在 `diary.ipc.ts` 中通过 `shadowConnectionManager.getDb()` 获取 Shadow DB 实例。
 */
export const shadowConnectionManager = new ShadowIndexConnectionManager();
