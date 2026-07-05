import { AppDatabase } from './types'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '@baishou/shared'
import { executeRawSql } from './raw-sql.executor'
import { FTS_SYNC_TRIGGER_STATEMENTS } from './schema/fts'
import { withExpoAgentDatabaseLock } from './expo-agent-db.lock'
import { isAgentMigrationArchiveImport } from './migration-context'
import {
  AGENT_DB_COLUMN_PATCHES,
  MEMORY_EMBEDDINGS_CREATE_SQL,
  MEMORY_EMBEDDINGS_INDEX_SQL,
  SYSTEM_SETTINGS_CREATE_SQL
} from './agent-schema-compat'

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
export interface EmbeddedMigrations {
  journal: MigrationJournal
  sqlByTag: Record<string, string>
}

export class MigrationService {
  private db: AppDatabase
  private client: any // 兼容 LibSQL.Client、Better-SQLite3、expo-sqlite
  private migrationDir: string
  private embedded?: EmbeddedMigrations

  constructor(db: AppDatabase, client: any, migrationDir: string, embedded?: EmbeddedMigrations) {
    this.db = db
    this.client = client
    this.migrationDir = migrationDir
    this.embedded = embedded
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

      // 归档导入的旧库可能缺 order_index 等列；在任何 Drizzle agent_* 查询前补齐
      if (isAgentMigrationArchiveImport()) {
        await this._ensureAgentSchemaColumns()
      }

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
              // 旧版 agent.sqlite 仅有部分 0000 表，回填迁移记录后仍需补齐 Next 新增表
              await this._ensureSystemSettingsTable()
              await this._ensureMemoryEmbeddingsTable()
            }
          }
        } catch (e: any) {
          logger.warn('[MigrationService] 旧库检测失败，将使用全新迁移流程:', e)
        }
      }

      const journal = await this.readMigrationJournal()
      if (journal.entries.length === 0) {
        logger.info('[MigrationService] 迁移日志为空，无需执行。')
        await this._ensureSystemSettingsTable()
        await this._ensureMemoryEmbeddingsTable()
        await this._ensureAgentSchemaColumns()
        await this._backfillAgentMessagesOrderIndex()
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

      await this._ensureSystemSettingsTable()
      await this._ensureMemoryEmbeddingsTable()
      await this._ensureAgentSchemaColumns()
      await this._backfillAgentMessagesOrderIndex()

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

  /**
   * 确保 system_settings 表存在（Flutter v3 agent.sqlite 升级后常见缺失）。
   */
  private async _ensureSystemSettingsTable(): Promise<void> {
    try {
      const table = await this._executeSql(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'`
      )
      if (table.rows.length > 0) return

      logger.info('[MigrationService] 创建缺失的 system_settings 表...')
      await this._executeSql(SYSTEM_SETTINGS_CREATE_SQL)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn('[MigrationService] system_settings 表检查失败（非阻塞）:', message)
    }
  }

  /**
   * 确保 memory_embeddings 表存在（原 0001 迁移；squash 后旧库可能缺整张表）。
   */
  private async _ensureMemoryEmbeddingsTable(): Promise<void> {
    try {
      const table = await this._executeSql(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='memory_embeddings'`
      )
      if (table.rows.length > 0) return

      logger.info('[MigrationService] 创建缺失的 memory_embeddings 表...')
      await this._executeSql(MEMORY_EMBEDDINGS_CREATE_SQL)
      await this._executeSql(MEMORY_EMBEDDINGS_INDEX_SQL)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn('[MigrationService] memory_embeddings 表检查失败（非阻塞）:', message)
    }
  }

  /**
   * 按 agent-schema-compat 清单补齐旧库缺失列（squash 迁移后未执行的增量变更）。
   */
  private async _ensureAgentSchemaColumns(): Promise<void> {
    const columnsByTable = new Map<string, Set<string>>()

    for (const patch of AGENT_DB_COLUMN_PATCHES) {
      let names = columnsByTable.get(patch.table)
      if (!names) {
        const tableInfo = await this._executeSql(`PRAGMA table_info(${patch.table})`)
        if (tableInfo.rows.length === 0) continue
        names = new Set(
          tableInfo.rows.map((c: { name?: string }) => c.name).filter(Boolean) as string[]
        )
        columnsByTable.set(patch.table, names)
      }

      if (names.has(patch.column)) continue

      try {
        logger.info(`[MigrationService] 添加 ${patch.table}.${patch.column} 列...`)
        await this._executeSql(patch.ddl)
        names.add(patch.column)
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        logger.warn(
          `[MigrationService] ${patch.table}.${patch.column} 列检查失败（非阻塞）:`,
          message
        )
      }
    }
  }

  /**
   * 旧版 agent.sqlite / 早期 Next 库可能缺 order_index 或全为 0；
   * 按 session 内 created_at 顺序回填，保证导入后 Drizzle 查询可用。
   */
  private async _backfillAgentMessagesOrderIndex(): Promise<void> {
    try {
      const tableInfo = await this._executeSql(`PRAGMA table_info(agent_messages)`)
      if (tableInfo.rows.length === 0) return
      const hasOrderIndex = tableInfo.rows.some((c: { name?: string }) => c.name === 'order_index')
      if (!hasOrderIndex) return

      await this._executeSql(`
        WITH ordered AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY session_id
              ORDER BY created_at, id
            ) - 1 AS new_idx
          FROM agent_messages
        )
        UPDATE agent_messages
        SET order_index = (
          SELECT new_idx FROM ordered WHERE ordered.id = agent_messages.id
        )
        WHERE order_index IS NULL
           OR order_index != (
             SELECT new_idx FROM ordered WHERE ordered.id = agent_messages.id
           )
      `)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn('[MigrationService] agent_messages.order_index 回填失败（非阻塞）:', message)
    }
  }

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

      // 事务提交成功后，记录本次迁移执行情况（raw SQL，避免与 runAsync 混用 prepareSync）
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
}
