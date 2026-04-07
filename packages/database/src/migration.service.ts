import { Client } from '@libsql/client';
import { AppDatabase } from './types';
import * as fs from 'fs';
import * as path from 'path';
import { migrationsTable } from './schema/migrations';

export interface MigrationJournal {
  version: string;
  dialect: string;
  entries: Array<{
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
}

/**
 * Agent DB 迁移服务
 *
 * 仅负责 Agent 数据库（baishou_agent.db）的 schema 迁移。
 * 影子索引（shadow_index.db）的建表由 ShadowIndexConnectionManager 独立管理。
 *
 * 设计说明：
 * - 读取 resources/database/drizzle/_journal.json 确定迁移版本列表
 * - 对每个未执行的迁移，读取对应 .sql 文件并执行
 * - 执行记录写入 __drizzle_migrations 表（供后续版本比对）
 * - 支持旧版 DB 探测（Legacy Backfill）：如果发现没有迁移记录表但有 agent_sessions，
 *   则视为旧库并直接标记为已执行首个迁移
 */
export class MigrationService {
  private db: AppDatabase;
  private client: Client;
  private migrationDir: string;

  constructor(db: AppDatabase, client: Client, migrationDir: string) {
    this.db = db;
    this.client = client;
    this.migrationDir = migrationDir;
  }

  public async runMigrations(): Promise<void> {
    try {
      console.log('[MigrationService] 检查 Agent DB 迁移，目录:', this.migrationDir);

      let hasMigrationsTable = await this.migrationsTableExists();

      if (!hasMigrationsTable) {
        console.log('[MigrationService] 未发现迁移跟踪表，判断是否为旧库...');
        try {
          // 检测旧版 DB：如果有 agent_sessions 表但没有迁移跟踪，视为旧库
          const legacyCheck = await this.client.execute(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='agent_sessions'`
          );
          if (legacyCheck.rows.length > 0) {
            console.log('[MigrationService] 检测到旧版 Agent DB，回填迁移记录表...');
            await this.client.execute(`
              CREATE TABLE IF NOT EXISTS __drizzle_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                tag TEXT NOT NULL,
                executed_at INTEGER NOT NULL
              )
            `);
            hasMigrationsTable = true;

            // 标记首个迁移已执行（旧库已有这些表）
            const journal = await this.readMigrationJournal();
            const firstMigration = journal.entries[0];
            if (firstMigration) {
              await this.client.execute({
                sql: `INSERT OR IGNORE INTO __drizzle_migrations (version, tag, executed_at) VALUES (?, ?, ?)`,
                args: [firstMigration.idx, firstMigration.tag, Date.now()]
              });

              // 确保旧库中的 compression_snapshots 有正确的字段类型
              // （旧库中 session_id 是 INTEGER，需要通过重建表迁移）
              console.log('[MigrationService] 检查旧库 compression_snapshots 字段兼容性...');
              await this._ensureCompressionSnapshotsCompatibility();
            }
          }
        } catch (e) {
          console.warn('[MigrationService] 旧库检测失败，将使用全新迁移流程:', e);
        }
      }

      const journal = await this.readMigrationJournal();
      if (journal.entries.length === 0) {
        console.log('[MigrationService] 迁移日志为空，无需执行。');
        return;
      }

      const appliedMigrations = hasMigrationsTable ? await this.getAppliedMigrations() : [];
      const appliedVersions = new Set(appliedMigrations.map((m) => Number(m.version)));

      const pendingMigrations = journal.entries
        .filter((entry) => !appliedVersions.has(entry.idx))
        .sort((a, b) => a.idx - b.idx);

      if (pendingMigrations.length === 0) {
        console.log('[MigrationService] Agent DB Schema 已是最新版本。');
      } else {
        console.log(`[MigrationService] 发现 ${pendingMigrations.length} 个待执行迁移...`);
        for (const migration of pendingMigrations) {
          await this.executeMigration(migration);
        }
      }

      // Agent 消息 FTS 虚拟表（仅服务于 Agent 聊天记录全文搜索）
      // 注意：影子索引 FTS (journals_fts) 由 ShadowIndexConnectionManager 独立管理
      console.log('[MigrationService] 确保 Agent 消息 FTS5 虚拟表存在...');
      try {
        await this.client.execute(`
          CREATE VIRTUAL TABLE IF NOT EXISTS agent_messages_fts USING fts5(
            part_id UNINDEXED,
            message_id UNINDEXED,
            session_id UNINDEXED,
            content,
            tokenize='unicode61'
          )
        `);
      } catch (ftsError: any) {
        console.warn('[MigrationService] FTS5 不支持，跳过 Agent FTS 表:', ftsError.message);
      }

      console.log('[MigrationService] Agent DB 迁移同步完成！');
    } catch (error) {
      console.error('[MigrationService] 迁移执行过程中发生致命错误:', error);
      throw error;
    }
  }

  /**
   * 确保 compression_snapshots 的 session_id / covered_up_to_message_id 是 TEXT 类型。
   * 旧库中这两列是 INTEGER，需要重建表迁移。
   */
  private async _ensureCompressionSnapshotsCompatibility(): Promise<void> {
    try {
      const tableInfo = await this.client.execute(`PRAGMA table_info(compression_snapshots)`);
      const cols = tableInfo.rows;
      const sessionIdCol = cols.find((c: any) => c.name === 'session_id');
      if (sessionIdCol && (sessionIdCol.type as string).toUpperCase() === 'INTEGER') {
        console.log('[MigrationService] 重建 compression_snapshots（INTEGER→TEXT）...');
        await this.client.execute(`ALTER TABLE compression_snapshots RENAME TO _comp_snap_old`);
        await this.client.execute(`
          CREATE TABLE compression_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            session_id TEXT NOT NULL,
            summary_text TEXT NOT NULL,
            covered_up_to_message_id TEXT NOT NULL,
            message_count INTEGER NOT NULL,
            token_count INTEGER,
            created_at INTEGER NOT NULL
          )
        `);
        await this.client.execute(`
          INSERT INTO compression_snapshots
            (id, session_id, summary_text, covered_up_to_message_id, message_count, created_at)
          SELECT id, CAST(session_id AS TEXT), summary_text,
                 CAST(covered_up_to_message_id AS TEXT), message_count, created_at
          FROM _comp_snap_old
        `);
        await this.client.execute(`DROP TABLE _comp_snap_old`);
        console.log('[MigrationService] compression_snapshots 重建完成。');
      }
    } catch (e: any) {
      console.warn('[MigrationService] compression_snapshots 兼容性检查失败（非阻塞）:', e.message);
    }
  }

  private async migrationsTableExists(): Promise<boolean> {
    try {
      const table = await this.client.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'`
      );
      return table.rows.length > 0;
    } catch (error) {
      console.warn('[MigrationService] 检查迁移表存在性时出错。', error);
      return false;
    }
  }

  private async readMigrationJournal(): Promise<MigrationJournal> {
    const journalPath = path.join(this.migrationDir, 'meta', '_journal.json');

    if (!fs.existsSync(journalPath)) {
      console.warn('[MigrationService] 未找到 _journal.json，路径:', journalPath);
      return { version: '7', dialect: 'sqlite', entries: [] };
    }

    try {
      const journalContent = fs.readFileSync(journalPath, 'utf-8');
      return JSON.parse(journalContent) as MigrationJournal;
    } catch (error) {
      console.error('[MigrationService] 读取 _journal.json 失败:', error);
      throw error;
    }
  }

  private async getAppliedMigrations(): Promise<{ version: number }[]> {
    try {
      return await this.db.select({ version: migrationsTable.version }).from(migrationsTable);
    } catch (error) {
      console.error('[MigrationService] 读取已执行迁移记录失败！', error);
      throw error;
    }
  }

  private async executeMigration(migration: MigrationJournal['entries'][0]): Promise<void> {
    const sqlFilePath = path.join(this.migrationDir, `${migration.tag}.sql`);

    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`[MigrationService] 缺失迁移 SQL 文件: ${sqlFilePath}`);
    }

    try {
      console.log(`[MigrationService] -> 执行迁移: ${migration.tag}.sql (v${migration.idx})`);
      const startTime = Date.now();

      const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
      const statements = sqlContent
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        try {
          await this.client.execute(statement);
        } catch (err) {
          console.error(`[MigrationService] 语句执行失败:\n---\n${statement}\n---`);
          throw err;
        }
      }

      // 确保迁移跟踪表存在并记录
      if (!(await this.migrationsTableExists())) {
        await this.client.execute(`
          CREATE TABLE IF NOT EXISTS __drizzle_migrations (
            version INTEGER PRIMARY KEY NOT NULL,
            tag TEXT NOT NULL,
            executed_at INTEGER NOT NULL
          )
        `);
      }

      await this.db.insert(migrationsTable).values({
        version: migration.idx,
        tag: migration.tag,
        executedAt: Date.now()
      });

      console.log(`[MigrationService] <- 迁移 ${migration.tag} 成功，耗时 ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error(`[MigrationService] x- 迁移失败: ${migration.tag}`, error);
      throw error;
    }
  }
}
