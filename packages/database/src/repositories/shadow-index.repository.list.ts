import { expandMoodFilterValues, expandWeatherFilterValues } from '@baishou/shared'
import { eq, sql, like, and, inArray, desc, asc, gte, lte } from 'drizzle-orm'
import { shadowJournalIndexTable } from '../schema/shadow-index'
import type {
  DiaryListFilterOptions,
  ShadowEmbedDetectionRow,
  ShadowJournalRecord,
  ShadowJournalRow
} from './shadow-index.repository.types'
import type { ShadowIndexQueryContext } from './shadow-index.repository.query-context'

export class ShadowIndexListOps {
  constructor(private readonly ctx: ShadowIndexQueryContext) {}

  private buildListFilterWhere(options: DiaryListFilterOptions) {
    const conditions: any[] = [this.ctx.vaultFilter()]

    if (options.year != null && options.month != null) {
      const monthStr = String(options.month).padStart(2, '0')
      conditions.push(like(shadowJournalIndexTable.date, `${options.year}-${monthStr}%`))
    }

    if (options.favorite) {
      conditions.push(eq(shadowJournalIndexTable.isFavorite, true))
    }

    if (options.weathers && options.weathers.length > 0) {
      const expanded = expandWeatherFilterValues(options.weathers)
      conditions.push(inArray(shadowJournalIndexTable.weather, expanded))
    }

    if (options.moods && options.moods.length > 0) {
      const expanded = expandMoodFilterValues(options.moods)
      conditions.push(inArray(shadowJournalIndexTable.mood, expanded))
    }

    return and(...conditions)
  }

  async listFiltered(options: DiaryListFilterOptions = {}): Promise<ShadowJournalRow[]> {
    /** 列表 preview 专用：raw_content 仅取前 500 字，不可用于需要全文的场景 */
    const where = this.buildListFilterWhere(options)
    const orderFn =
      options.orderBy === 'asc'
        ? asc(shadowJournalIndexTable.date)
        : desc(shadowJournalIndexTable.date)

    let query = this.ctx.database
      .select({
        id: shadowJournalIndexTable.id,
        vaultId: shadowJournalIndexTable.vaultId,
        filePath: shadowJournalIndexTable.filePath,
        date: shadowJournalIndexTable.date,
        createdAt: shadowJournalIndexTable.createdAt,
        updatedAt: shadowJournalIndexTable.updatedAt,
        contentHash: shadowJournalIndexTable.contentHash,
        fileMtimeMs: shadowJournalIndexTable.fileMtimeMs,
        fileSize: shadowJournalIndexTable.fileSize,
        weather: shadowJournalIndexTable.weather,
        mood: shadowJournalIndexTable.mood,
        location: shadowJournalIndexTable.location,
        locationDetail: shadowJournalIndexTable.locationDetail,
        isFavorite: shadowJournalIndexTable.isFavorite,
        hasMedia: shadowJournalIndexTable.hasMedia,
        tags: shadowJournalIndexTable.tags,
        tagColors: shadowJournalIndexTable.tagColors,
        rawContent: sql<string | null>`substr(${shadowJournalIndexTable.rawContent}, 1, 500)`.as(
          'raw_content'
        )
      })
      .from(shadowJournalIndexTable)
      .where(where)
      .orderBy(orderFn)
    if (options.limit != null && options.limit > 0) {
      query = query.limit(options.limit) as typeof query
    }
    if (options.offset != null && options.offset > 0) {
      query = query.offset(options.offset) as typeof query
    }

    return (await query) as ShadowJournalRow[]
  }

  async countFiltered(
    options: Omit<DiaryListFilterOptions, 'limit' | 'offset'> = {}
  ): Promise<number> {
    const where = this.buildListFilterWhere(options)
    const result = await this.ctx.database
      .select({ count: sql<number>`count(*)` })
      .from(shadowJournalIndexTable)
      .where(where)
    return result[0]?.count || 0
  }

  async listAllWithFTS(options?: {
    limit?: number
    offset?: number
    orderBy?: 'asc' | 'desc'
  }): Promise<(ShadowJournalRecord & { rawContent: string; tagsStr: string })[]> {
    const direction = options?.orderBy === 'asc' ? sql.raw('ASC') : sql.raw('DESC')
    const limit = Math.max(0, Math.floor(options?.limit ?? 0))
    const offset = Math.max(0, Math.floor(options?.offset ?? 0))

    let queryStr = sql`
      SELECT i.*, i.raw_content as rawContent, i.tags as rawTags
      FROM journals_index i
      LEFT JOIN journals_fts f ON i.id = f.rowid
      WHERE i.vault_id = ${this.ctx.vaultId}
      ORDER BY i.date ${direction}
    `
    if (limit > 0) queryStr = sql`${queryStr} LIMIT ${limit}`
    if (offset > 0) queryStr = sql`${queryStr} OFFSET ${offset}`

    try {
      interface RawFTSRow {
        id: number
        vault_id: string
        file_path: string
        date: string
        created_at: string
        updated_at: string
        content_hash: string
        file_mtime_ms?: number | null
        file_size?: number | null
        weather: string | null
        mood: string | null
        location: string | null
        location_detail: string | null
        is_favorite: number
        has_media: number
        rawContent: string | null
        rawTags: string | null
      }
      const rawResults = (await this.ctx.database.all(queryStr)) as RawFTSRow[]
      return rawResults.map((row) => ({
        id: row.id,
        vaultId: row.vault_id,
        filePath: row.file_path,
        date: row.date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        contentHash: row.content_hash,
        fileMtimeMs: row.file_mtime_ms ?? null,
        fileSize: row.file_size ?? null,
        weather: row.weather,
        mood: row.mood,
        location: row.location,
        locationDetail: row.location_detail,
        isFavorite: Boolean(row.is_favorite),
        hasMedia: Boolean(row.has_media),
        rawContent: row.rawContent || '',
        tagsStr: row.rawTags || ''
      }))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[ShadowIndex] listAllWithFTS error:', msg)
      return []
    }
  }

  /**
   * 待嵌入检测瘦查询：只取 id / date / updated_at / raw_content，无 LIMIT，不读文件级 content_hash。
   * 与日记统计一致，排除 Archives 等总结目录里误入影子索引的记录。
   */
  async listForEmbedDetection(): Promise<ShadowEmbedDetectionRow[]> {
    const rows = await this.ctx.database
      .select({
        id: shadowJournalIndexTable.id,
        date: shadowJournalIndexTable.date,
        updatedAt: shadowJournalIndexTable.updatedAt,
        rawContent: shadowJournalIndexTable.rawContent
      })
      .from(shadowJournalIndexTable)
      .where(this.ctx.withVault(this.ctx.journalPathNotUnderSkippedDirs()))
      .orderBy(sql`${shadowJournalIndexTable.date} ASC`)

    return rows.map((row) => ({
      id: row.id,
      date: row.date,
      updatedAt: row.updatedAt,
      rawContent: row.rawContent ?? ''
    }))
  }

  async listAll(options?: {
    limit?: number
    offset?: number
    orderBy?: 'asc' | 'desc'
  }): Promise<ShadowJournalRecord[]> {
    const orderFn =
      options?.orderBy === 'asc'
        ? sql`${shadowJournalIndexTable.date} ASC`
        : sql`${shadowJournalIndexTable.date} DESC`

    let query = this.ctx.database
      .select()
      .from(shadowJournalIndexTable)
      .where(this.ctx.vaultFilter())
      .orderBy(orderFn)

    if (options?.limit) query = query.limit(options.limit) as any
    if (options?.offset) query = query.offset(options.offset) as any

    return await query
  }

  async count(): Promise<number> {
    const result = await this.ctx.database
      .select({ count: sql<number>`count(*)` })
      .from(shadowJournalIndexTable)
      .where(this.ctx.withVault(this.ctx.journalPathNotUnderSkippedDirs()))
    return result[0]?.count || 0
  }

  async getActivityData(year?: number): Promise<{ date: string; count: number }[]> {
    try {
      const rows = await this.ctx.database
        .select({
          date: shadowJournalIndexTable.date,
          count: sql<number>`1`
        })
        .from(shadowJournalIndexTable)
        .where(
          year != null
            ? this.ctx.withVault(
                this.ctx.journalPathNotUnderSkippedDirs(),
                gte(shadowJournalIndexTable.date, `${year}-01-01`),
                lte(shadowJournalIndexTable.date, `${year}-12-31`)
              )
            : this.ctx.withVault(this.ctx.journalPathNotUnderSkippedDirs())
        )
        .orderBy(sql`${shadowJournalIndexTable.date} ASC`)
      return rows.map((row) => ({
        date: row.date,
        count: Number(row.count) || 1
      }))
    } catch (e: any) {
      console.warn('[ShadowIndex] getActivityData error:', e.message)
      return []
    }
  }
}
