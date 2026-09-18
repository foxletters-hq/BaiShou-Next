import { eq, sql, like, inArray, gte, lte } from 'drizzle-orm'
import { shadowJournalIndexTable } from '../schema/shadow-index'
import type { AppDatabase } from '../types'
import type {
  DiaryListFilterOptions,
  ShadowEmbedDetectionRow,
  ShadowFTSResult,
  ShadowJournalRecord,
  ShadowJournalRow,
  ShadowSyncFingerprint
} from './shadow-index.repository.types'
import { ShadowIndexQueryContext } from './shadow-index.repository.query-context'
import { ShadowIndexSearchOps } from './shadow-index.repository.search'
import { ShadowIndexListOps } from './shadow-index.repository.list'

export class ShadowIndexQueryOps {
  private readonly ctx: ShadowIndexQueryContext
  private readonly searchOps: ShadowIndexSearchOps
  private readonly listOps: ShadowIndexListOps

  constructor(database: AppDatabase, vaultId: string) {
    this.ctx = new ShadowIndexQueryContext(database, vaultId)
    this.searchOps = new ShadowIndexSearchOps(this.ctx)
    this.listOps = new ShadowIndexListOps(this.ctx)
  }

  async findByDatePrefix(dayStr: string): Promise<ShadowJournalRecord[]> {
    return await this.ctx.database
      .select()
      .from(shadowJournalIndexTable)
      .where(this.ctx.withVault(like(shadowJournalIndexTable.date, `${dayStr}%`)))
  }

  async findByDateRange(startIso: string, endIso: string): Promise<ShadowJournalRecord[]> {
    return await this.ctx.database
      .select()
      .from(shadowJournalIndexTable)
      .where(
        this.ctx.withVault(
          gte(shadowJournalIndexTable.date, startIso),
          lte(shadowJournalIndexTable.date, endIso)
        )
      )
      .orderBy(sql`${shadowJournalIndexTable.date} ASC`)
  }

  /** 共同回忆预览：仅拉取日期范围内的正文，避免全量 FTS 扫描 */
  async listContentSinceDate(startIso: string): Promise<{ date: string; rawContent: string }[]> {
    const rows = await this.ctx.database
      .select({
        date: shadowJournalIndexTable.date,
        rawContent: shadowJournalIndexTable.rawContent
      })
      .from(shadowJournalIndexTable)
      .where(this.ctx.withVault(gte(shadowJournalIndexTable.date, startIso)))
      .orderBy(sql`${shadowJournalIndexTable.date} ASC`)

    return rows.map((row) => ({
      date: row.date,
      rawContent: row.rawContent || ''
    }))
  }

  async getHashByDate(dateIso: string): Promise<string | null> {
    const rows = await this.ctx.database
      .select({ contentHash: shadowJournalIndexTable.contentHash })
      .from(shadowJournalIndexTable)
      .where(this.ctx.withVault(eq(shadowJournalIndexTable.date, dateIso)))
      .limit(1)

    return rows[0]?.contentHash ?? null
  }

  /**
   * 批量读取日期对应的同步指纹（contentHash + mtime/size），
   * 供全量扫描时避免 N 次单条查询，并支持按 mtime/size 快路径跳过。
   */
  async getHashesByDates(dateIsos: string[]): Promise<Map<string, ShadowSyncFingerprint>> {
    const uniqueDates = [...new Set(dateIsos.filter(Boolean))]
    if (uniqueDates.length === 0) return new Map()

    const rows = await this.ctx.database
      .select({
        date: shadowJournalIndexTable.date,
        contentHash: shadowJournalIndexTable.contentHash,
        fileMtimeMs: shadowJournalIndexTable.fileMtimeMs,
        fileSize: shadowJournalIndexTable.fileSize
      })
      .from(shadowJournalIndexTable)
      .where(this.ctx.withVault(inArray(shadowJournalIndexTable.date, uniqueDates)))

    const map = new Map<string, ShadowSyncFingerprint>()
    for (const row of rows) {
      const day = row.date.split('T')[0] ?? row.date
      if (row.contentHash) {
        map.set(day, {
          contentHash: row.contentHash,
          fileMtimeMs: row.fileMtimeMs ?? null,
          fileSize: row.fileSize ?? null
        })
      }
    }
    return map
  }

  async getAllRecords(): Promise<Pick<ShadowJournalRecord, 'id' | 'date' | 'filePath'>[]> {
    return await this.ctx.database
      .select({
        id: shadowJournalIndexTable.id,
        date: shadowJournalIndexTable.date,
        filePath: shadowJournalIndexTable.filePath
      })
      .from(shadowJournalIndexTable)
      .where(this.ctx.vaultFilter())
  }

  countSearchFTS(query: string): Promise<number> {
    return this.searchOps.countSearchFTS(query)
  }

  searchFTS(query: string, limit?: number, offset?: number): Promise<ShadowFTSResult[]> {
    return this.searchOps.searchFTS(query, limit, offset)
  }

  listFiltered(options?: DiaryListFilterOptions): Promise<ShadowJournalRow[]> {
    return this.listOps.listFiltered(options)
  }

  countFiltered(options?: Omit<DiaryListFilterOptions, 'limit' | 'offset'>): Promise<number> {
    return this.listOps.countFiltered(options)
  }

  async findByIds(ids: number[]): Promise<ShadowJournalRow[]> {
    if (ids.length === 0) return []
    return (await this.ctx.database
      .select()
      .from(shadowJournalIndexTable)
      .where(this.ctx.withVault(inArray(shadowJournalIndexTable.id, ids)))) as ShadowJournalRow[]
  }

  async findById(id: number): Promise<ShadowJournalRow | null> {
    const rows = await this.ctx.database
      .select()
      .from(shadowJournalIndexTable)
      .where(this.ctx.withVault(eq(shadowJournalIndexTable.id, id)))
      .limit(1)
    return (rows[0] as ShadowJournalRow) ?? null
  }

  async findByDate(dateIso: string): Promise<ShadowJournalRow | null> {
    const rows = await this.ctx.database
      .select()
      .from(shadowJournalIndexTable)
      .where(this.ctx.withVault(eq(shadowJournalIndexTable.date, dateIso)))
      .limit(1)
    return (rows[0] as ShadowJournalRow) ?? null
  }

  listAllWithFTS(options?: {
    limit?: number
    offset?: number
    orderBy?: 'asc' | 'desc'
  }): Promise<(ShadowJournalRecord & { rawContent: string; tagsStr: string })[]> {
    return this.listOps.listAllWithFTS(options)
  }

  listForEmbedDetection(): Promise<ShadowEmbedDetectionRow[]> {
    return this.listOps.listForEmbedDetection()
  }

  listAll(options?: {
    limit?: number
    offset?: number
    orderBy?: 'asc' | 'desc'
  }): Promise<ShadowJournalRecord[]> {
    return this.listOps.listAll(options)
  }

  count(): Promise<number> {
    return this.listOps.count()
  }

  getActivityData(year?: number): Promise<{ date: string; count: number }[]> {
    return this.listOps.getActivityData(year)
  }
}
