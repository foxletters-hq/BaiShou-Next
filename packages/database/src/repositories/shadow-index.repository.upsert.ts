import { eq, sql } from 'drizzle-orm'
import { shadowJournalIndexTable } from '../schema/shadow-index'
import type { AppDatabase } from '../types'
import type { UpsertShadowIndexPayload } from './shadow-index.repository.types'
import { segmentChinese } from './shadow-index.repository.text'

function buildUpsertSet(
  indexData: Omit<UpsertShadowIndexPayload, 'rawContent' | 'tags'>,
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

export class ShadowIndexUpsertOps {
  constructor(private readonly database: AppDatabase) {}

  async upsert(payload: UpsertShadowIndexPayload): Promise<number> {
    const { rawContent, tags, ...indexData } = payload

    const result = await this.database
      .insert(shadowJournalIndexTable)
      .values({ ...indexData, rawContent, tags })
      .onConflictDoUpdate({
        target: [shadowJournalIndexTable.filePath],
        set: buildUpsertSet(indexData, rawContent, tags)
      })
      .returning({ id: shadowJournalIndexTable.id })

    const rowId = result[0]?.id
    if (rowId == null) {
      throw new Error('[ShadowIndex] upsert 返回了空 ID')
    }

    await syncFtsRowAsync(this.database, rowId, rawContent, tags, '[ShadowIndex] FTS 同步失败 (非阻塞)')
    return rowId
  }

  async batchUpsert(payloads: UpsertShadowIndexPayload[]): Promise<number[]> {
    if (payloads.length === 0) return []

    const rowIds: number[] = []
    const isBetterSqlite = (this.database as any).session?.client?.prepare !== undefined

    if (isBetterSqlite) {
      await (this.database as any).transaction((tx: any) => {
        for (const payload of payloads) {
          const { rawContent, tags, ...indexData } = payload

          const result = tx
            .insert(shadowJournalIndexTable)
            .values({ ...indexData, rawContent, tags })
            .onConflictDoUpdate({
              target: [shadowJournalIndexTable.filePath],
              set: buildUpsertSet(indexData, rawContent, tags)
            })
            .returning({ id: shadowJournalIndexTable.id })
            .all()

          const rowId = result[0]?.id
          if (rowId != null) {
            rowIds.push(rowId)
            syncFtsRowSync(tx, rowId, rawContent, tags)
          }
        }
      })
    } else {
      await this.database.transaction(async (tx) => {
        for (const payload of payloads) {
          const { rawContent, tags, ...indexData } = payload

          const result = await tx
            .insert(shadowJournalIndexTable)
            .values({ ...indexData, rawContent, tags })
            .onConflictDoUpdate({
              target: [shadowJournalIndexTable.filePath],
              set: buildUpsertSet(indexData, rawContent, tags)
            })
            .returning({ id: shadowJournalIndexTable.id })

          const rowId = result[0]?.id
          if (rowId != null) {
            rowIds.push(rowId)
            await syncFtsRowAsync(tx, rowId, rawContent, tags, `[ShadowIndex] 批量 FTS 同步失败 (非阻塞) [ID=${rowId}]`)
          }
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
