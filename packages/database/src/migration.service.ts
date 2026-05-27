import { AppDatabase } from './types'
import * as fs from 'fs'
import * as path from 'path'
import { migrationsTable } from './schema/migration-table'
import { logger } from '@baishou/shared'
import { executeRawSql } from './raw-sql.executor'
import { FTS_SYNC_TRIGGER_STATEMENTS } from './schema/fts'

export interface MigrationJournal {
  version: string
  dialect: string
  entries: Array<{
    idx: number
    version: string
    when: number
    tag: string
    breakpoints: boolean
  }>
}

/**
 * Agent DB 迁移服务
 *
 * 仅负责 Agent 数据库（baishou_agent.db）的 schema 迁移。
 * 影子索引（shadow_index.db）的建表由 ShadowIndexConnectionManager 独立管理。
 */
export class MigrationService {
  private db: AppDatabase
  private client: any // 兼容 LibSQL.Client 和 Better-SQLite3.Database
  private migrationDir: string

  constructor(db: AppDatabase, client: any, migrationDir: string) {
    this.db = db
    this.client = client
    this.migrationDir = migrationDir
  }

  private async _executeSql(statement: string, args: any[] = []): Promise<any> {
    return executeRawSql(this.client, statement, args)
  }

  public async runMigrations(): Promise<void> {
    try {
      logger.info('[MigrationService] 检查 Agent DB 迁移，目录:', this.migrationDir)

      let hasMigrationsTable = await this.migrationsTableExists()

      if (!hasMigrationsTable) {
        logger.info('[MigrationService] 未发现迁移跟踪表，判断是否为旧库...')
        try {
          // 检测旧版 DB：如果有 agent_sessions 表但没有迁移跟踪，视为旧库
          const legacyCheck = await this._executeSql(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='agent_sessions'`
          )
          if (legacyCheck.rows.length > 0) {
            logger.info('[MigrationService] 检测到旧版 Agent DB，回填迁移记录表...')
            await this._executeSql(`
              CREATE TABLE IF NOT EXISTS __drizzle_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                tag TEXT NOT NULL,
                executed_at INTEGER NOT NULL
              )
            `)
            hasMigrationsTable = true

            // 标记首个迁移已执行（旧库已有这些表）
            const journal = await this.readMigrationJournal()
            const firstMigration = journal.entries[0]
            if (firstMigration) {
              await this._executeSql(
                `INSERT OR IGNORE INTO __drizzle_migrations (version, tag, executed_at) VALUES (?, ?, ?)`,
                [firstMigration.idx, firstMigration.tag, Date.now()]
              )

              // 确保旧库中的 compression_snapshots 有正确的字段类型
              logger.info('[MigrationService] 检查旧库 compression_snapshots 字段兼容性...')
              await this._ensureCompressionSnapshotsCompatibility()
            }
          }
        } catch (e: any) {
          logger.warn('[MigrationService] 旧库检测失败，将使用全新迁移流程:', e)
        }
      }

      const journal = await this.readMigrationJournal()
      if (journal.entries.length === 0) {
        logger.info('[MigrationService] 迁移日志为空，无需执行。')
        return
      }

      const appliedMigrations = hasMigrationsTable ? await this.getAppliedMigrations() : []
      const appliedVersions = new Set(appliedMigrations.map((m) => Number(m.version)))

      const pendingMigrations = journal.entries
        .filter((entry) => !appliedVersions.has(entry.idx))
        .sort((a, b) => a.idx - b.idx)

      if (pendingMigrations.length === 0) {
        logger.info('[MigrationService] Agent DB Schema 已是最新版本。')
      } else {
        logger.info(`[MigrationService] 发现 ${pendingMigrations.length} 个待执行迁移...`)
        for (const migration of pendingMigrations) {
          await this.executeMigration(migration)
        }
      }

      logger.info('[MigrationService] 确保 Agent 消息 FTS5 虚拟表存在...')
      try {
        await this._executeSql(`
          CREATE VIRTUAL TABLE IF NOT EXISTS agent_messages_fts USING fts5(
            part_id UNINDEXED,
            message_id UNINDEXED,
            session_id UNINDEXED,
            content,
            tokenize='unicode61'
          )
        `)
      } catch (ftsError: any) {
        logger.warn('[MigrationService] FTS5 不支持，跳过 Agent FTS 表:', ftsError.message)
      }

      logger.info('[MigrationService] 确保 Agent 消息 FTS 触发器与索引回填完成...')
      try {
        const ftsTable = await this._executeSql(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='agent_messages_fts'`
        )
        if (ftsTable.rows.length > 0) {
      for (const triggerName of [
        'agent_parts_fts_insert',
        'agent_parts_fts_update',
        'agent_parts_fts_delete'
      ]) {
        await this._executeSql(`DROP TRIGGER IF EXISTS ${triggerName}`)
      }
      for (const statement of FTS_SYNC_TRIGGER_STATEMENTS) {
        await this._executeSql(statement)
      }

          await this._executeSql(`
            INSERT OR IGNORE INTO agent_messages_fts(part_id, message_id, session_id, content)
            SELECT
              p.id,
              p.message_id,
              p.session_id,
              json_extract(p.data, '$.text')
            FROM agent_parts p
            WHERE p.type = 'text'
              AND COALESCE(json_extract(p.data, '$.isReasoning'), 0) IN (0, false)
              AND json_extract(p.data, '$.text') IS NOT NULL
              AND LENGTH(TRIM(json_extract(p.data, '$.text'))) > 0
              AND NOT EXISTS (
                SELECT 1 FROM agent_messages_fts f WHERE f.part_id = p.id
              )
          `)

          logger.info('[MigrationService] Agent 消息 FTS 触发器与索引回填完成。')
        }
      } catch (e: any) {
        logger.warn('[MigrationService] Agent FTS 基础设施初始化失败（非阻塞）:', e.message)
      }

      logger.info('[MigrationService] Agent DB 迁移同步完成！')
    } catch (error: any) {
      logger.error('[MigrationService] 迁移执行过程中发生致命错误:', error)
      throw error
    }
  }

  /**
   * 确保 compression_snapshots 的 session_id / covered_up_to_message_id 是 TEXT 类型。
   */
  private async _ensureCompressionSnapshotsCompatibility(): Promise<void> {
    try {
      const tableInfo = await this._executeSql(`PRAGMA table_info(compression_snapshots)`)
      const cols = tableInfo.rows
      const sessionIdCol = cols.find((c: any) => c.name === 'session_id')
      if (sessionIdCol && (sessionIdCol.type as string).toUpperCase() === 'INTEGER') {
        logger.info('[MigrationService] 重建 compression_snapshots（INTEGER→TEXT）...')
        await this._executeSql(`ALTER TABLE compression_snapshots RENAME TO _comp_snap_old`)
        await this._executeSql(`
          CREATE TABLE compression_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            session_id TEXT NOT NULL,
            summary_text TEXT NOT NULL,
            covered_up_to_message_id TEXT NOT NULL,
            message_count INTEGER NOT NULL,
            token_count INTEGER,
            created_at INTEGER NOT NULL
          )
        `)
        await this._executeSql(`
          INSERT INTO compression_snapshots
            (id, session_id, summary_text, covered_up_to_message_id, message_count, created_at)
          SELECT id, CAST(session_id AS TEXT), summary_text,
                 CAST(covered_up_to_message_id AS TEXT), message_count, created_at
          FROM _comp_snap_old
        `)
        await this._executeSql(`DROP TABLE _comp_snap_old`)
        logger.info('[MigrationService] compression_snapshots 重建完成。')
      }
    } catch (e: any) {
      logger.warn('[MigrationService] compression_snapshots 兼容性检查失败（非阻塞）:', e.message)
    }
  }

  private async migrationsTableExists(): Promise<boolean> {
    try {
      const table = await this._executeSql(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'`
      )
      return table.rows.length > 0
    } catch (error: any) {
      logger.warn('[MigrationService] 检查迁移表存在性时出错。', error)
      return false
    }
  }

  private async readMigrationJournal(): Promise<MigrationJournal> {
    const journalPath = path.join(this.migrationDir, 'meta', '_journal.json')

    if (!fs.existsSync(journalPath)) {
      logger.warn('[MigrationService] 未找到 _journal.json，路径:', journalPath)
      return { version: '7', dialect: 'sqlite', entries: [] }
    }

    try {
      const journalContent = fs.readFileSync(journalPath, 'utf-8')
      return JSON.parse(journalContent) as MigrationJournal
    } catch (error: any) {
      logger.error('[MigrationService] 读取 _journal.json 失败:', error)
      throw error
    }
  }

  private async getAppliedMigrations(): Promise<{ version: number }[]> {
    try {
      return await this.db.select({ version: migrationsTable.version }).from(migrationsTable)
    } catch (error: any) {
      logger.error('[MigrationService] 读取已执行迁移记录失败！', error)
      throw error
    }
  }

  private async executeMigration(migration: MigrationJournal['entries'][0]): Promise<void> {
    const sqlFilePath = path.join(this.migrationDir, `${migration.tag}.sql`)

    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`[MigrationService] 缺失迁移 SQL 文件: ${sqlFilePath}`)
    }

    try {
      logger.info(`[MigrationService] -> 执行迁移: ${migration.tag}.sql (v${migration.idx})`)
      const startTime = Date.now()

      const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8')
      const statements = sqlContent
        .split('--> statement-breakpoint')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)

      // 确保迁移跟踪表在事务前已存在（CREATE TABLE 不能在事务内与 INSERT 混用于某些 SQLite 驱动）
      if (!(await this.migrationsTableExists())) {
        await this._executeSql(`
          CREATE TABLE IF NOT EXISTS __drizzle_migrations (
            version INTEGER PRIMARY KEY NOT NULL,
            tag TEXT NOT NULL,
            executed_at INTEGER NOT NULL
          )
        `)
      }

      // 用事务包裹所有迁移语句，保证原子性：要么全部成功，要么全部回滚
      await this._executeSql('BEGIN')
      try {
        for (const statement of statements) {
          try {
            // 如果 statement 试图创建 __drizzle_migrations 且该表在外部已建好，则跳过以防报错
            const trimmed = statement.trim().toLowerCase()
            if (
              trimmed.startsWith('create table') &&
              (trimmed.includes('__drizzle_migrations') ||
                trimmed.includes('`__drizzle_migrations`'))
            ) {
              if (await this.migrationsTableExists()) {
                logger.info('[MigrationService] 迁移跟踪表已在外部建立，跳过迁移文件中的建表语句。')
                continue
              }
            }
            await this._executeSql(statement)
          } catch (err) {
            logger.error(`[MigrationService] 语句执行失败:\n---\n${statement}\n---`)
            throw err
          }
        }
        await this._executeSql('COMMIT')
      } catch (txError: any) {
        // 回滚整个迁移，避免数据库处于半迁移状态
        try {
          await this._executeSql('ROLLBACK')
        } catch (rollbackErr: any) {
          logger.error(`[MigrationService] 事务回滚失败（可能已自动回滚）:`, rollbackErr)
        }
        throw txError
      }

      // 事务提交成功后，记录本次迁移执行情况
      await this.db.insert(migrationsTable).values({
        version: migration.idx,
        tag: migration.tag,
        executedAt: Date.now()
      })

      logger.info(
        `[MigrationService] <- 迁移 ${migration.tag} 成功，耗时 ${Date.now() - startTime}ms`
      )
    } catch (error: any) {
      logger.error(`[MigrationService] x- 迁移失败: ${migration.tag}`, error)
      throw error
    }
  }
}
