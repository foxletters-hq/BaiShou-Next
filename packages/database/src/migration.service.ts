import { AppDatabase } from './types'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '@baishou/shared'
import { executeRawSql } from './raw-sql.executor'
import { FTS_SYNC_TRIGGER_STATEMENTS } from './schema/fts'
import { withExpoAgentDatabaseLock } from './expo-agent-db.lock'
import { isAgentMigrationArchiveImport } from './migration-context'
import type {
  EmbeddedMigrations,
  MigrationJournal,
  MigrationSqlExecutor
} from './migration.service.types'
import {
  backfillAgentMessagesOrderIndex,
  backfillMemoryEmbeddingsVaultNameColumn,
  ensureAgentSchemaColumns,
  ensureCompressionSnapshotsCompatibility,
  ensureEmbedLedgerTable,
  ensureGraphTables,
  ensureMemoryEmbeddingsTable,
  ensureMemoryEmbeddingsVaultIndex,
  ensureSystemSettingsTable,
  migrateSummariesAndAssistantsVault,
  migrateVaultNameToVaultId,
  retireDiaryEmbedJobsTable
} from './migration.service.schema'

export type { EmbeddedMigrations, MigrationJournal } from './migration.service.types'

/**
 * Agent DB 迁移服务
 *
 * 仅负责 Agent 数据库的 schema 迁移。
 * 影子索引（shadow_index.db）的建表由 ShadowIndexConnectionManager 独立管理。
 */
export class MigrationService {
  private db: AppDatabase
  private client: any
  private migrationDir: string
  private embedded?: EmbeddedMigrations
  /** 可选：存储根，用于读 vault_registry.json 做 name→id 回填 */
  private storageRoot?: string

  constructor(
    db: AppDatabase,
    client: any,
    migrationDir: string,
    embedded?: EmbeddedMigrations,
    options?: { storageRoot?: string }
  ) {
    this.db = db
    this.client = client
    this.migrationDir = migrationDir
    this.embedded = embedded
    this.storageRoot = options?.storageRoot
  }

  private async _executeSql(statement: string, args: any[] = []): Promise<any> {
    return executeRawSql(this.client, statement, args)
  }

  public async runMigrations(): Promise<void> {
    return withExpoAgentDatabaseLock(this.db, () => this.runMigrationsUnlocked())
  }

  private async runMigrationsUnlocked(): Promise<void> {
    try {
      logger.info('[MigrationService] 检查 Agent DB 迁移，目录:', this.migrationDir)

      // 归档导入的旧库可能缺 order_index 等列；在任何 agent_* 查询前补齐
      if (isAgentMigrationArchiveImport()) {
        await this._ensureAgentSchemaColumns()
      }

      let hasMigrationsTable = await this.migrationsTableExists()

      if (!hasMigrationsTable) {
        logger.info('[MigrationService] 未发现迁移跟踪表，判断是否为旧库...')
        try {
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

            const journal = await this.readMigrationJournal()
            const firstMigration = journal.entries[0]
            if (firstMigration) {
              await this._executeSql(
                `INSERT OR IGNORE INTO __drizzle_migrations (version, tag, executed_at) VALUES (?, ?, ?)`,
                [firstMigration.idx, firstMigration.tag, Date.now()]
              )

              logger.info('[MigrationService] 检查旧库 compression_snapshots 字段兼容性...')
              await this._ensureCompressionSnapshotsCompatibility()
              await this._ensureCompatSchema()
            }
          }
        } catch (e: any) {
          logger.warn('[MigrationService] 旧库检测失败，将使用全新迁移流程:', e)
        }
      }

      const journal = await this.readMigrationJournal()
      if (journal.entries.length === 0) {
        logger.info('[MigrationService] 迁移日志为空，无需执行。')
        await this._ensureCompatSchema()
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

          // 归档导入期间跳过全量 FTS 回填，避免与 legacy 导出查询争抢堆内存导致 OOM
          if (!isAgentMigrationArchiveImport()) {
            await this._backfillAgentMessagesFts()
            logger.info('[MigrationService] Agent 消息 FTS 触发器与索引回填完成。')
          } else {
            logger.info(
              '[MigrationService] 归档导入期间跳过 Agent FTS 全量回填（导入完成后将异步补建）。'
            )
          }
        }
      } catch (e: any) {
        logger.warn('[MigrationService] Agent FTS 基础设施初始化失败（非阻塞）:', e.message)
      }

      await this._ensureCompatSchema()

      logger.info('[MigrationService] Agent DB 迁移同步完成！')
    } catch (error: any) {
      logger.error('[MigrationService] 迁移执行过程中发生致命错误:', error)
      throw error
    }
  }

  /** 归档导入完成后补建历史 Agent 消息 FTS 索引（异步调用，不阻塞 UI） */
  public async backfillAgentMessagesFts(): Promise<void> {
    return withExpoAgentDatabaseLock(this.db, () => this._backfillAgentMessagesFtsUnlocked())
  }

  private async _backfillAgentMessagesFtsUnlocked(): Promise<void> {
    const ftsTable = await this._executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='agent_messages_fts'`
    )
    if (ftsTable.rows.length === 0) {
      logger.info('[MigrationService] Agent FTS 表不存在，跳过历史索引补建。')
      return
    }
    await this._backfillAgentMessagesFts()
    logger.info('[MigrationService] Agent 消息 FTS 历史索引补建完成。')
  }

  private async _backfillAgentMessagesFts(): Promise<void> {
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
    if (this.embedded) {
      return this.embedded.journal
    }

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
      const result = await this._executeSql(`SELECT version FROM __drizzle_migrations`)
      return result.rows.map((row: { version?: number | string }) => ({
        version: Number(row.version)
      }))
    } catch (error: any) {
      logger.error('[MigrationService] 读取已执行迁移记录失败！', error)
      throw error
    }
  }

  private async executeMigration(migration: MigrationJournal['entries'][0]): Promise<void> {
    const sqlContent = this.embedded?.sqlByTag[migration.tag]
    if (!sqlContent) {
      const sqlFilePath = path.join(this.migrationDir, `${migration.tag}.sql`)
      if (!fs.existsSync(sqlFilePath)) {
        throw new Error(`[MigrationService] 缺失迁移 SQL 文件: ${sqlFilePath}`)
      }
    }

    try {
      logger.info(`[MigrationService] -> 执行迁移: ${migration.tag}.sql (v${migration.idx})`)
      const startTime = Date.now()

      const resolvedSql =
        sqlContent ?? fs.readFileSync(path.join(this.migrationDir, `${migration.tag}.sql`), 'utf-8')
      const statements = resolvedSql
        .split('--> statement-breakpoint')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)

      if (!(await this.migrationsTableExists())) {
        await this._executeSql(`
          CREATE TABLE IF NOT EXISTS __drizzle_migrations (
            version INTEGER PRIMARY KEY NOT NULL,
            tag TEXT NOT NULL,
            executed_at INTEGER NOT NULL
          )
        `)
      }

      await this._executeSql('BEGIN')
      try {
        for (const statement of statements) {
          try {
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
        try {
          await this._executeSql('ROLLBACK')
        } catch (rollbackErr: any) {
          logger.error(`[MigrationService] 事务回滚失败（可能已自动回滚）:`, rollbackErr)
        }
        throw txError
      }

      await this._executeSql(
        `INSERT INTO __drizzle_migrations (version, tag, executed_at) VALUES (?, ?, ?)`,
        [migration.idx, migration.tag, Date.now()]
      )

      logger.info(
        `[MigrationService] <- 迁移 ${migration.tag} 成功，耗时 ${Date.now() - startTime}ms`
      )
    } catch (error: any) {
      logger.error(`[MigrationService] x- 迁移失败: ${migration.tag}`, error)
      throw error
    }
  }

  private sqlExec(): MigrationSqlExecutor {
    return (statement, args) => this._executeSql(statement, args)
  }

  private async _ensureCompatSchema(): Promise<void> {
    await this._ensureSystemSettingsTable()
    await this._ensureMemoryEmbeddingsTable()
    await this._ensureGraphTables()
    await this._ensureEmbedLedgerTable()
    await this._retireDiaryEmbedJobsTable()
    await this._ensureAgentSchemaColumns()
    await ensureMemoryEmbeddingsVaultIndex(this.sqlExec())
    await backfillMemoryEmbeddingsVaultNameColumn(this.sqlExec())
    await migrateVaultNameToVaultId(this.sqlExec(), this.storageRoot)
    await migrateSummariesAndAssistantsVault(this.sqlExec())
    await this._backfillAgentMessagesOrderIndex()
  }

  private async _ensureCompressionSnapshotsCompatibility(): Promise<void> {
    await ensureCompressionSnapshotsCompatibility(this.sqlExec())
  }

  private async _ensureAgentSchemaColumns(): Promise<void> {
    await ensureAgentSchemaColumns(this.sqlExec())
  }

  private async _backfillAgentMessagesOrderIndex(): Promise<void> {
    await backfillAgentMessagesOrderIndex(this.sqlExec())
  }

  private async _ensureMemoryEmbeddingsTable(): Promise<void> {
    await ensureMemoryEmbeddingsTable(this.sqlExec())
  }

  private async _ensureEmbedLedgerTable(): Promise<void> {
    await ensureEmbedLedgerTable(this.sqlExec())
  }

  private async _retireDiaryEmbedJobsTable(): Promise<void> {
    await retireDiaryEmbedJobsTable(this.sqlExec())
  }

  private async _ensureGraphTables(): Promise<void> {
    await ensureGraphTables(this.sqlExec())
  }

  private async _ensureSystemSettingsTable(): Promise<void> {
    await ensureSystemSettingsTable(this.sqlExec())
  }
}
