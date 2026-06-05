import { eq, sql } from 'drizzle-orm'
import { shadowJournalIndexTable } from '../schema/shadow-index'
import type { AppDatabase } from '../types'
import type { UpsertShadowIndexPayload } from './shadow-index.repository.types'
import { segmentChinese } from './shadow-index.repository.text'

type IdPathMaps = {
  idByPath: Map<string, number>
  pathById: Map<number, string>
}

type UpsertDb = Pick<AppDatabase, 'insert' | 'update' | 'select' | 'run' | 'transaction'>

type SqliteDriverKind = 'better-sqlite' | 'expo-sync' | 'async'

function detectSqliteDriver(database: AppDatabase): SqliteDriverKind {
  const client = (database as any).session?.client
  if (client?.prepare !== undefined) return 'better-sqlite'
  if (client?.prepareSync !== undefined) return 'expo-sync'
  return 'async'
}

export function normalizeShadowFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/')
}

function buildMapsFromRows(rows: Array<{ id: number; filePath: string }>): IdPathMaps {
  const idByPath = new Map<string, number>()
  const pathById = new Map<number, string>()
  for (const row of rows) {
    const normalized = normalizeShadowFilePath(row.filePath)
    idByPath.set(normalized, Number(row.id))
    pathById.set(Number(row.id), normalized)
  }
  return { idByPath, pathById }
}

function trackAssignedId(maps: IdPathMaps, filePath: string, rowId: number): void {
  const normalizedPath = normalizeShadowFilePath(filePath)
  const previousPath = maps.pathById.get(rowId)
  if (previousPath != null && previousPath !== normalizedPath) {
    maps.idByPath.delete(previousPath)
  }
  maps.idByPath.set(normalizedPath, rowId)
  maps.pathById.set(rowId, normalizedPath)
}

async function loadIdPathMaps(database: UpsertDb): Promise<IdPathMaps> {
  const existing = await database
    .select({
      id: shadowJournalIndexTable.id,
      filePath: shadowJournalIndexTable.filePath
    })
    .from(shadowJournalIndexTable)

  return buildMapsFromRows(existing)
}

function buildUpsertSet(
  indexData: Omit<UpsertShadowIndexPayload, 'rawContent' | 'tags' | 'id' | 'filePath'>,
  rawContent: string,
  tags: string
) {
  return {
    date: indexData.date,
    createdAt: indexData.createdAt,
    updatedAt: indexData.updatedAt,
    contentHash: indexData.contentHash,
    weather: indexData.weather ?? null,
    mood: indexData.mood ?? null,
    location: indexData.location ?? null,
    locationDetail: indexData.locationDetail ?? null,
    isFavorite: indexData.isFavorite,
    hasMedia: indexData.hasMedia,
    rawContent,
    tags
  }
}

function syncFtsRowSync(
  tx: { run: (query: ReturnType<typeof sql>) => void },
  rowId: number,
  rawContent: string,
  tags: string
): void {
  try {
    tx.run(sql`DELETE FROM journals_fts WHERE rowid = ${rowId}`)
    tx.run(
      sql`INSERT INTO journals_fts(rowid, content, tags) VALUES(${rowId}, ${segmentChinese(rawContent)}, ${segmentChinese(tags)})`
    )
  } catch (e: any) {
    console.warn(
      `[ShadowIndex] 批量 FTS 同步失败 (非阻塞) [ID=${rowId}]:`,
      e?.message,
      e?.cause?.message ?? e?.cause ?? ''
    )
  }
}

async function syncFtsRowAsync(
  db: { run: AppDatabase['run'] },
  rowId: number,
  rawContent: string,
  tags: string,
  logPrefix: string
): Promise<void> {
  try {
    await db.run(sql`DELETE FROM journals_fts WHERE rowid = ${rowId}`)
    await db.run(
      sql`INSERT INTO journals_fts(rowid, content, tags) VALUES(${rowId}, ${segmentChinese(rawContent)}, ${segmentChinese(tags)})`
    )
  } catch (e: any) {
    console.warn(`${logPrefix}:`, e?.message, e?.cause?.message ?? e?.cause ?? '')
  }
}

async function upsertOne(
  db: UpsertDb,
  payload: UpsertShadowIndexPayload,
  maps: IdPathMaps
): Promise<number> {
  const filePath = normalizeShadowFilePath(payload.filePath)
  const { rawContent, tags, id: requestedId, filePath: _path, ...indexData } = payload

  const existingId = maps.idByPath.get(filePath)
  if (existingId != null) {
    await db
      .update(shadowJournalIndexTable)
      .set(buildUpsertSet(indexData, rawContent, tags))
      .where(eq(shadowJournalIndexTable.id, existingId))

    trackAssignedId(maps, filePath, existingId)
    return existingId
  }

  let insertId: number | undefined
  if (requestedId != null && requestedId > 0) {
    const ownerPath = maps.pathById.get(Number(requestedId))
    if (ownerPath == null || ownerPath === filePath) {
      insertId = Number(requestedId)
    }
  }

  const baseValues = {
    ...indexData,
    filePath,
    rawContent,
    tags
  }

  // 关键：用 ON CONFLICT (id) DO UPDATE 原子处理 PK 冲突。
  // 之前用 try/catch + 第二次 INSERT 会在 SQLite 事务中产生
  // "Failed to run the query 'commit'"：一旦首条 INSERT 失败，
  // 整个事务进入 needs-rollback 状态，即便异常被 catch 接住，
  // 事务也已经中毒，后续 COMMIT 必然失败。
  // ON CONFLICT 是单条原子语句，根本不会让事务中毒。
  const result = await db
    .insert(shadowJournalIndexTable)
    .values(insertId != null ? { ...baseValues, id: insertId } : baseValues)
    .onConflictDoUpdate({
      target: shadowJournalIndexTable.id,
      set: buildUpsertSet(indexData, rawContent, tags)
    })
    .returning({ id: shadowJournalIndexTable.id })

  const rowId = result[0]?.id
  if (rowId == null) {
    throw new Error('[ShadowIndex] insert 返回了空 ID')
  }

  trackAssignedId(maps, filePath, rowId)
  return rowId
}

function upsertOneSync(
  tx: UpsertDb & { run: (query: ReturnType<typeof sql>) => void },
  payload: UpsertShadowIndexPayload,
  maps: IdPathMaps
): number {
  const filePath = normalizeShadowFilePath(payload.filePath)
  const { rawContent, tags, id: requestedId, filePath: _path, ...indexData } = payload

  const existingId = maps.idByPath.get(filePath)
  if (existingId != null) {
    tx.update(shadowJournalIndexTable)
      .set(buildUpsertSet(indexData, rawContent, tags))
      .where(eq(shadowJournalIndexTable.id, existingId))
      .run()

    trackAssignedId(maps, filePath, existingId)
    return existingId
  }

  let insertId: number | undefined
  if (requestedId != null && requestedId > 0) {
    const ownerPath = maps.pathById.get(Number(requestedId))
    if (ownerPath == null || ownerPath === filePath) {
      insertId = Number(requestedId)
    }
  }

  const baseValues = {
    ...indexData,
    filePath,
    rawContent,
    tags
  }

  // 关键：用 ON CONFLICT (id) DO UPDATE 原子处理 PK 冲突。
  // 同步版本（better-sqlite3）同样不能在事务中吞掉 INSERT 异常后
  // 再发第二条语句——SQLite 事务已经中毒，commit 必然挂。
  const result = tx
    .insert(shadowJournalIndexTable)
    .values(insertId != null ? { ...baseValues, id: insertId } : baseValues)
    .onConflictDoUpdate({
      target: shadowJournalIndexTable.id,
      set: buildUpsertSet(indexData, rawContent, tags)
    })
    .returning({ id: shadowJournalIndexTable.id })
    .all() as any

  const rowId = result[0]?.id
  if (rowId == null) {
    throw new Error('[ShadowIndex] insert 返回了空 ID')
  }

  trackAssignedId(maps, filePath, rowId)
  return rowId
}

export class ShadowIndexUpsertOps {
  private static writeMutex: Promise<void> = Promise.resolve()

  /** 等待进行中的 upsert / batchUpsert 结束（Vault 切换 disconnect 前调用） */
  static async waitForIdle(): Promise<void> {
    await ShadowIndexUpsertOps.writeMutex
  }

  constructor(private readonly database: AppDatabase) {}

  private async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const previous = ShadowIndexUpsertOps.writeMutex
    ShadowIndexUpsertOps.writeMutex = previous.then(() => gate)
    await previous
    try {
      return await fn()
    } finally {
      release!()
    }
  }

  async upsert(payload: UpsertShadowIndexPayload): Promise<number> {
    const maps = await loadIdPathMaps(this.database)
    const rowId = await upsertOne(this.database, payload, maps)

    await syncFtsRowAsync(
      this.database,
      rowId,
      payload.rawContent,
      payload.tags,
      '[ShadowIndex] FTS 同步失败 (非阻塞)'
    )
    return rowId
  }

  async batchUpsert(payloads: UpsertShadowIndexPayload[]): Promise<number[]> {
    if (payloads.length === 0) return []

    return this.withWriteLock(async () => {
      const maps = await loadIdPathMaps(this.database)
      const rowIds: number[] = []
      const driver = detectSqliteDriver(this.database)

      // 关键：FTS 同步必须在主事务 COMMIT 之后执行。
      // SQLite 在事务内任一语句失败后会把整个事务置为 needs-rollback 状态，
      // 即便用 try/catch 接住异常，事务也已经中毒，后续 COMMIT 必然失败。
      // 把 FTS 挪到事务外（自带 try/catch 兜底）就能让索引写入与 FTS 同步真正解耦，
      // FTS 不可用（最常见于 Android 系统 SQLite 未编译 FTS5）也不会影响保存。
      if (driver === 'better-sqlite' || driver === 'expo-sync') {
        // expo-sqlite 的 Drizzle transaction 是同步 API：async 回调会在 await 前 commit，
        // 必须走 upsertOneSync，否则并发写同一连接会导致 Android 原生崩溃。
        await this.database.transaction(async (tx) => {
          for (const payload of payloads) {
            const rowId = upsertOneSync(
              tx as UpsertDb & { run: (query: ReturnType<typeof sql>) => void },
              payload,
              maps
            )
            rowIds.push(rowId)
          }
        })
        for (let i = 0; i < payloads.length; i++) {
          if (driver === 'better-sqlite') {
            syncFtsRowSync(
              this.database as UpsertDb & { run: (query: ReturnType<typeof sql>) => void },
              rowIds[i]!,
              payloads[i]!.rawContent,
              payloads[i]!.tags
            )
          } else {
            await syncFtsRowAsync(
              this.database,
              rowIds[i]!,
              payloads[i]!.rawContent,
              payloads[i]!.tags,
              `[ShadowIndex] 批量 FTS 同步失败 (非阻塞) [ID=${rowIds[i]!}]`
            )
          }
        }
      } else {
        await this.database.transaction(async (tx) => {
          for (const payload of payloads) {
            const rowId = await upsertOne(tx, payload, maps)
            rowIds.push(rowId)
          }
        })
        for (let i = 0; i < payloads.length; i++) {
          await syncFtsRowAsync(
            this.database,
            rowIds[i]!,
            payloads[i]!.rawContent,
            payloads[i]!.tags,
            `[ShadowIndex] 批量 FTS 同步失败 (非阻塞) [ID=${rowIds[i]!}]`
          )
        }
      }

      return rowIds
    })
  }

  async deleteById(id: number): Promise<void> {
    await this.database.delete(shadowJournalIndexTable).where(eq(shadowJournalIndexTable.id, id))

    try {
      await this.database.run(sql`DELETE FROM journals_fts WHERE rowid = ${id}`)
    } catch (e: any) {
      console.warn(
        '[ShadowIndex] FTS 删除失败 (非阻塞):',
        e?.message,
        e?.cause?.message ?? e?.cause ?? ''
      )
    }
  }
}
