import { createClient, Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '@baishou/shared';

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
    // 采用 V2 独立命名，与遗留或正在被 Windows 取用的旧版物理文件天然隔离，杜绝 SQLITE_CORRUPT 等底层文件复刻竞态
    const dbPath = path.join(vaultSystemDir, 'shadow_index_v2.db');

    // 如果是同一个路径且连接正常，复用旧连接
    if (this._currentDbPath === dbPath && this._client && this._db) {
      logger.info(`[ShadowDB] 复用已有连接: ${dbPath}`);
      return;
    }

    // 关闭旧连接
    this._disconnect();

    logger.info(`[ShadowDB] 正在连接影子索引库: ${dbPath}`);

    try {
      await this._initDatabase(dbPath);
    } catch (e: any) {
      // _ensureHealthyFile 已经在 _initDatabase 内部完成了损坏检测和文件清理。
      // 如果走到这里说明是建表/WAL等初始化本身出了意外，做一次简单重试即可。
      logger.error(`[ShadowDB] 数据库初始化失败: ${e.message}`);
      this._disconnect();

      try {
        await this._initDatabase(dbPath);
      } catch (retryErr: any) {
        // 二次失败不再阻塞应用启动——影子索引是纯缓存，可降级运行
        logger.error(`[ShadowDB] 重建仍失败，影子索引将不可用: ${retryErr.message}`);
        return;
      }
    }

    logger.info(`[ShadowDB] 影子索引库连接成功: ${dbPath}`);
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

  /**
   * 如果数据库文件已存在，检测其是否损坏。若损坏则删除。
   *
   * 关键设计：**绝不用 libsql 打开原始文件**。
   * Windows 的 libsql native addon 在 close() 后仍会延迟释放文件锁，
   * 导致同一进程内无法删除刚刚打开过的文件（EBUSY）。
   *
   * 解决方案：先用 fs.copyFileSync 复制到临时路径，用 libsql 探测副本，
   * 原始文件从未被 native addon 打开过，因此可以自由删除。
   */
  private async _ensureHealthyFile(dbPath: string): Promise<void> {
    if (!fs.existsSync(dbPath)) return; // 全新文件，无需探测

    const probePath = dbPath + '.probe';
    let isCorrupt = false;

    try {
      // 复制原始文件到探针路径（仅需读权限，不锁定原文件）
      fs.copyFileSync(dbPath, probePath);

      let probe: Client | null = null;
      try {
        probe = createClient({ url: `file:${probePath}` });
        const res = await probe.execute('PRAGMA quick_check;');
        const firstRow = res.rows[0];
        isCorrupt = !firstRow || firstRow['quick_check'] !== 'ok';
      } catch {
        isCorrupt = true;
      } finally {
        try { probe?.close(); } catch {}
      }
    } catch {
      // copyFileSync 失败（无读权限或并发删除），默认视作健康或让外边抛错
      return;
    } finally {
      // 尽力清理探针副本
      for (const f of [probePath, `${probePath}-wal`, `${probePath}-shm`]) {
        try { fs.unlinkSync(f); } catch {}
      }
    }

    if (!isCorrupt) return; // 文件健康

    logger.warn(`[ShadowDB] 检测到损坏的影子索引库，正在清理: ${dbPath}`);
    let canDelete = true;
    for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch (e: any) {
        logger.error(`[ShadowDB] 删除损坏文件失败: ${file}`, e.message);
        canDelete = false;
      }
    }

    if (!canDelete) {
      throw new Error(`无法清理损坏的影子索引库: ${dbPath}。文件可能正被其他程序占用，请关闭后重试。`);
    }
  }

  private async _initDatabase(dbPath: string): Promise<void> {
    // 确保父目录已存在
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 核心改进：先探后开。在创建正式连接之前，确保文件健康或已被抛出错误。
    await this._ensureHealthyFile(dbPath);

    const client = createClient({ url: `file:${dbPath}` });

    try {
      // WAL 模式：提升并发写入性能，对标原版 SQLite WAL 配置
      await client.execute('PRAGMA journal_mode=WAL');

      // 建表（幂等，始终 CREATE TABLE IF NOT EXISTS）
      await this._createTables(client);
    } catch (e: any) {
      try { client.close(); } catch {}
      throw e;
    }

    this._client = client;
    // Drizzle 包装
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
      logger.info('[ShadowDB] journals_fts FTS5 虚拟表创建成功');
    } catch (e: any) {
      logger.warn('[ShadowDB] FTS5 不可用，降级为普通表:', e.message);
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
