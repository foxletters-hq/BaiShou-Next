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

function isPrimaryKeyConflict(error: unknown): boolean {
  let cause: unknown = error
  while (cause != null && typeof cause === 'object') {
    const current = cause as { code?: string; message?: string; cause?: unknown }
    if (
      current.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
      current.message?.includes('UNIQUE constraint failed: journals_index.id')
    ) {
      return true
    }
    cause = current.cause
  }
  return false
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
    console.warn(`[ShadowIndex] 批量 FTS 同步失败 (非阻塞) [ID=${rowId}]:`, e.message)
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
    console.warn(`${logPrefix}:`, e.message)
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

  try {
    const result = await db
      .insert(shadowJournalIndexTable)
      .values(insertId != null ? { ...baseValues, id: insertId } : baseValues)
      .returning({ id: shadowJournalIndexTable.id })

    const rowId = result[0]?.id
    if (rowId == null) {
      throw new Error('[ShadowIndex] insert 返回了空 ID')
    }

    trackAssignedId(maps, filePath, rowId)
    return rowId
  } catch (error) {
    if (insertId == null || !isPrimaryKeyConflict(error)) {
      throw error
    }

    const result = await db
      .insert(shadowJournalIndexTable)
      .values(baseValues)
      .returning({ id: shadowJournalIndexTable.id })

    const rowId = result[0]?.id
    if (rowId == null) {
      throw new Error('[ShadowIndex] insert 返回了空 ID')
    }

    trackAssignedId(maps, filePath, rowId)
    return rowId
  }
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

  try {
    const result = tx
      .insert(shadowJournalIndexTable)
      .values(insertId != null ? { ...baseValues, id: insertId } : baseValues)
      .returning({ id: shadowJournalIndexTable.id })
      .all()

    const rowId = result[0]?.id
    if (rowId == null) {
      throw new Error('[ShadowIndex] insert 返回了空 ID')
    }

    trackAssignedId(maps, filePath, rowId)
    return rowId
  } catch (error) {
    if (insertId == null || !isPrimaryKeyConflict(error)) {
      throw error
    }

    const result = tx
      .insert(shadowJournalIndexTable)
      .values(baseValues)
      .returning({ id: shadowJournalIndexTable.id })
      .all()

    const rowId = result[0]?.id
    if (rowId == null) {
      throw new Error('[ShadowIndex] insert 返回了空 ID')
    }

    trackAssignedId(maps, filePath, rowId)
    return rowId
  }
}

export class ShadowIndexUpsertOps {
  constructor(private readonly database: AppDatabase) {}

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

    const maps = await loadIdPathMaps(this.database)
    const rowIds: number[] = []
    const isBetterSqlite = (this.database as any).session?.client?.prepare !== undefined

    if (isBetterSqlite) {
      await (this.database as any).transaction((tx: any) => {
        for (const payload of payloads) {
          const rowId = upsertOneSync(tx, payload, maps)
          rowIds.push(rowId)
          syncFtsRowSync(tx, rowId, payload.rawContent, payload.tags)
        }
      })
    } else {
      await this.database.transaction(async (tx) => {
        for (const payload of payloads) {
          const rowId = await upsertOne(tx, payload, maps)
          rowIds.push(rowId)
          await syncFtsRowAsync(
            tx,
            rowId,
            payload.rawContent,
            payload.tags,
            `[ShadowIndex] 批量 FTS 同步失败 (非阻塞) [ID=${rowId}]`
          )
        }
      })
    }

    return rowIds
  }

  async deleteById(id: number): Promise<void> {
    await this.database.delete(shadowJournalIndexTable).where(eq(shadowJournalIndexTable.id, id))

    try {
      await this.database.run(sql`DELETE FROM journals_fts WHERE rowid = ${id}`)
    } catch (e: any) {
      console.warn('[ShadowIndex] FTS 删除失败 (非阻塞):', e.message)
    }
  }
}
