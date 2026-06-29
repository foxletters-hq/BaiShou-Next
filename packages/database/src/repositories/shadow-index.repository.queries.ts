import {
  expandMoodFilterValues,
  expandWeatherFilterValues,
  buildJournalTreeSkipSqlLikeClauses
} from '@baishou/shared'
import { eq, sql, like, and, inArray, desc, asc, gte, lte } from 'drizzle-orm'
import { shadowJournalIndexTable } from '../schema/shadow-index'
import type { AppDatabase } from '../types'
import {
  cleanSegmentedSnippet,
  segmentChinese,
  normalizeSearchQuery
} from './shadow-index.repository.text'
import type {
  DiaryListFilterOptions,
  ShadowFTSResult,
  ShadowJournalRecord,
  ShadowJournalRow
} from './shadow-index.repository.types'

export class ShadowIndexQueryOps {
  constructor(
    private readonly database: AppDatabase,
    private readonly vaultName: string
  ) {}

  private vaultFilter() {
    return eq(shadowJournalIndexTable.vaultName, this.vaultName)
  }

  private withVault(...conditions: Parameters<typeof and>) {
    const extra = conditions.filter(Boolean)
    return extra.length > 0 ? and(this.vaultFilter(), ...extra) : this.vaultFilter()
  }

  /** 排除 Archives 等总结子目录中误入影子索引的记录 */
  private journalPathNotUnderSkippedDirs() {
    const clauses = buildJournalTreeSkipSqlLikeClauses('file_path').map((clause) => sql.raw(clause))
    return and(...clauses)
  }

  async findByDatePrefix(dayStr: string): Promise<ShadowJournalRecord[]> {
    return await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(this.withVault(like(shadowJournalIndexTable.date, `${dayStr}%`)))
  }

  async findByDateRange(startIso: string, endIso: string): Promise<ShadowJournalRecord[]> {
    return await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(
        this.withVault(
          gte(shadowJournalIndexTable.date, startIso),
          lte(shadowJournalIndexTable.date, endIso)
        )
      )
      .orderBy(sql`${shadowJournalIndexTable.date} ASC`)
  }

  async getHashByDate(dateIso: string): Promise<string | null> {
    const rows = await this.database
      .select({ contentHash: shadowJournalIndexTable.contentHash })
      .from(shadowJournalIndexTable)
      .where(this.withVault(eq(shadowJournalIndexTable.date, dateIso)))
      .limit(1)

    return rows[0]?.contentHash ?? null
  }

  /** 批量读取日期对应的 contentHash，供全量扫描时避免 N 次单条查询 */
  async getHashesByDates(dateIsos: string[]): Promise<Map<string, string>> {
    const uniqueDates = [...new Set(dateIsos.filter(Boolean))]
    if (uniqueDates.length === 0) return new Map()

    const rows = await this.database
      .select({
        date: shadowJournalIndexTable.date,
        contentHash: shadowJournalIndexTable.contentHash
      })
      .from(shadowJournalIndexTable)
      .where(this.withVault(inArray(shadowJournalIndexTable.date, uniqueDates)))

    const map = new Map<string, string>()
    for (const row of rows) {
      const day = row.date.split('T')[0] ?? row.date
      if (row.contentHash) {
        map.set(day, row.contentHash)
      }
    }
    return map
  }

  async getAllRecords(): Promise<Pick<ShadowJournalRecord, 'id' | 'date' | 'filePath'>[]> {
    return await this.database
      .select({
        id: shadowJournalIndexTable.id,
        date: shadowJournalIndexTable.date,
        filePath: shadowJournalIndexTable.filePath
      })
      .from(shadowJournalIndexTable)
      .where(this.vaultFilter())
  }

  /** 解析搜索词为 FTS 表达式与原始 term 列表 */
  private buildSearchTerms(
    query: string
  ): { rawTerms: string[]; ftsMatchExpr: string | null } | null {
    if (!query || query.trim().length === 0) return null
    const cleanedQuery = normalizeSearchQuery(query)
    if (!cleanedQuery) return null

    const rawTerms = cleanedQuery.split(/\s+/).filter(Boolean)
    if (rawTerms.length === 0) return null

    const ftsTokens: string[] = []
    for (const term of rawTerms) {
      const containsChinese = /[\u4e00-\u9fa5]/.test(term)
      if (containsChinese) {
        const segmented = segmentChinese(term)
        if (segmented) {
          ftsTokens.push(`"${segmented}"`)
        }
      } else {
        const cleaned = term.replace(/[^a-zA-Z0-9]/g, '').trim()
        if (cleaned) {
          ftsTokens.push(`${cleaned}*`)
        }
      }
    }

    return {
      rawTerms,
      ftsMatchExpr: ftsTokens.length > 0 ? ftsTokens.join(' ') : null
    }
  }

  /** FTS 命中总数（无 snippet，供分页计数） */
  async countSearchFTS(query: string): Promise<number> {
    const terms = this.buildSearchTerms(query)
    if (!terms?.ftsMatchExpr) return 0

    try {
      const rows = (await this.database.all(
        sql`
          SELECT COUNT(*) as cnt
          FROM journals_fts
          INNER JOIN journals_index i ON i.id = journals_fts.rowid
          WHERE journals_fts MATCH ${terms.ftsMatchExpr}
            AND i.vault_name = ${this.vaultName}
        `
      )) as Array<{ cnt: number }>
      return Number(rows[0]?.cnt ?? 0)
    } catch (e: any) {
      console.warn('[ShadowIndex] FTS 计数失败 (非阻塞):', e.message)
      return 0
    }
  }

  private mapSqlRowToIndexRow(row: Record<string, unknown>): ShadowJournalRow {
    return {
      id: Number(row.rowid ?? row.id),
      vaultName: String(row.vault_name ?? row.vaultName ?? this.vaultName),
      filePath: String(row.file_path ?? row.filePath ?? ''),
      date: String(row.date ?? ''),
      createdAt: String(row.created_at ?? row.createdAt ?? ''),
      updatedAt: String(row.updated_at ?? row.updatedAt ?? ''),
      contentHash: String(row.content_hash ?? row.contentHash ?? ''),
      weather: (row.weather as string | null) ?? null,
      mood: (row.mood as string | null) ?? null,
      location: (row.location as string | null) ?? null,
      locationDetail: (row.location_detail ?? row.locationDetail ?? null) as string | null,
      isFavorite: Boolean(row.is_favorite ?? row.isFavorite),
      hasMedia: Boolean(row.has_media ?? row.hasMedia),
      rawContent: (row.raw_content ?? row.rawContent ?? null) as string | null,
      tags: (row.tags ?? null) as string | null,
      tagColors: (row.tag_colors ?? row.tagColors ?? null) as string | null
    }
  }

  async searchFTS(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ShadowFTSResult[]> {
    const terms = this.buildSearchTerms(query)
    if (!terms) return []

    const { rawTerms, ftsMatchExpr } = terms
    const needCount = limit + offset

    let ftsResults: ShadowFTSResult[] = []
    if (ftsMatchExpr) {
      try {
        const rawResults = (await this.database.all(
          sql`
            SELECT 
              journals_fts.rowid,
              i.vault_name,
              i.file_path,
              i.date,
              i.created_at,
              i.updated_at,
              i.content_hash,
              i.weather,
              i.mood,
              i.location,
              i.location_detail,
              i.is_favorite,
              i.has_media,
              i.raw_content,
              i.tags,
              snippet(journals_fts, 0, '<b>', '</b>', '...', 64) as content_snippet,
              journals_fts.rank as fts_rank
            FROM journals_fts
            INNER JOIN journals_index i ON i.id = journals_fts.rowid
            WHERE journals_fts MATCH ${ftsMatchExpr}
              AND i.vault_name = ${this.vaultName}
            ORDER BY fts_rank ASC
            LIMIT ${needCount}
          `
        )) as any[]

        ftsResults = rawResults.map((row) => ({
          rowid: row.rowid,
          contentSnippet: cleanSegmentedSnippet(row.content_snippet),
          tags: cleanSegmentedSnippet(row.tags),
          rankScore: row.fts_rank,
          indexRow: this.mapSqlRowToIndexRow(row)
        }))
      } catch (e: any) {
        console.warn('[ShadowIndex] FTS 搜索失败 (非阻塞):', e.message)
      }
    }

    // FTS 已凑满一页时跳过 LIKE 兜底，减少全表扫描
    let likeRows: ShadowJournalRow[] = []
    if (ftsResults.length < needCount) {
      try {
        const likeQueries = rawTerms.map((term) => {
          const escaped = `%${term.replace(/[%_\\]/g, '\\$&')}%`
          return sql`(raw_content LIKE ${escaped} ESCAPE '\\' OR tags LIKE ${escaped} ESCAPE '\\')`
        })

        const rows = (await this.database
          .select()
          .from(shadowJournalIndexTable)
          .where(this.withVault(...likeQueries))
          .limit(needCount)) as ShadowJournalRow[]

        if (rows) {
          likeRows = rows
        }
      } catch (e: any) {
        console.warn('[ShadowIndex] LIKE 搜索失败 (非阻塞):', e.message)
      }
    }

    // 3. 合并与去重
    const mergedResults: ShadowFTSResult[] = [...ftsResults]
    const seenIds = new Set(ftsResults.map((r) => r.rowid))

    // 辅助函数，为 LIKE 结果生成 snippet 高亮
    const generateLikeSnippet = (content: string, terms: string[]): string => {
      if (!content) return ''
      const lowerContent = content.toLowerCase()
      let matchIndex = -1
      let matchTerm = ''

      for (const term of terms) {
        const lowerTerm = term.toLowerCase()
        const idx = lowerContent.indexOf(lowerTerm)
        if (idx !== -1) {
          if (matchIndex === -1 || idx < matchIndex) {
            matchIndex = idx
            matchTerm = term
          }
        }
      }

      if (matchIndex === -1) {
        return content.length > 64 ? content.substring(0, 64) + '...' : content
      }

      const start = Math.max(0, matchIndex - 30)
      const end = Math.min(content.length, matchIndex + matchTerm.length + 30)
      const snippet = content.substring(start, end)
      const prefix = start > 0 ? '...' : ''
      const suffix = end < content.length ? '...' : ''

      const offsetVal = start
      const snippetMatchIndex = matchIndex - offsetVal
      const termLen = matchTerm.length

      const partBefore = snippet.substring(0, snippetMatchIndex)
      const partMatched = snippet.substring(snippetMatchIndex, snippetMatchIndex + termLen)
      const partAfter = snippet.substring(snippetMatchIndex + termLen)

      return prefix + partBefore + '<b>' + partMatched + '</b>' + partAfter + suffix
    }

    const generateLikeTagsSnippet = (tagsStr: string, terms: string[]): string => {
      if (!tagsStr) return ''
      let highlighted = tagsStr
      for (const term of terms) {
        try {
          const regex = new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi')
          highlighted = highlighted.replace(regex, '<b>$1</b>')
        } catch {
          // ignore invalid regex
        }
      }
      return highlighted
    }

    for (const row of likeRows) {
      if (seenIds.has(row.id)) continue
      seenIds.add(row.id)

      const snippet = generateLikeSnippet(row.rawContent || '', rawTerms)
      const tagsSnippet = generateLikeTagsSnippet(row.tags || '', rawTerms)

      mergedResults.push({
        rowid: row.id,
        contentSnippet: snippet,
        tags: tagsSnippet,
        rankScore: 9999,
        indexRow: row
      })
    }

    return mergedResults.slice(offset, offset + limit)
  }

  private buildListFilterWhere(options: DiaryListFilterOptions) {
    const conditions: any[] = [this.vaultFilter()]

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

    let query = this.database
      .select({
        id: shadowJournalIndexTable.id,
        vaultName: shadowJournalIndexTable.vaultName,
        filePath: shadowJournalIndexTable.filePath,
        date: shadowJournalIndexTable.date,
        createdAt: shadowJournalIndexTable.createdAt,
        updatedAt: shadowJournalIndexTable.updatedAt,
        contentHash: shadowJournalIndexTable.contentHash,
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
    const result = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(shadowJournalIndexTable)
      .where(where)
    return result[0]?.count || 0
  }

  async findByIds(ids: number[]): Promise<ShadowJournalRow[]> {
    if (ids.length === 0) return []
    return (await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(this.withVault(inArray(shadowJournalIndexTable.id, ids)))) as ShadowJournalRow[]
  }

  async findById(id: number): Promise<ShadowJournalRow | null> {
    const rows = await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(this.withVault(eq(shadowJournalIndexTable.id, id)))
      .limit(1)
    return (rows[0] as ShadowJournalRow) ?? null
  }

  async findByDate(dateIso: string): Promise<ShadowJournalRow | null> {
    const rows = await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(this.withVault(eq(shadowJournalIndexTable.date, dateIso)))
      .limit(1)
    return (rows[0] as ShadowJournalRow) ?? null
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
      WHERE i.vault_name = ${this.vaultName}
      ORDER BY i.date ${direction}
    `
    if (limit > 0) queryStr = sql`${queryStr} LIMIT ${limit}`
    if (offset > 0) queryStr = sql`${queryStr} OFFSET ${offset}`

    try {
      interface RawFTSRow {
        id: number
        vault_name: string
        file_path: string
        date: string
        created_at: string
        updated_at: string
        content_hash: string
        weather: string | null
        mood: string | null
        location: string | null
        location_detail: string | null
        is_favorite: number
        has_media: number
        rawContent: string | null
        rawTags: string | null
      }
      const rawResults = (await this.database.all(queryStr)) as RawFTSRow[]
      return rawResults.map((row) => ({
        id: row.id,
        vaultName: row.vault_name,
        filePath: row.file_path,
        date: row.date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        contentHash: row.content_hash,
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

  async listAll(options?: {
    limit?: number
    offset?: number
    orderBy?: 'asc' | 'desc'
  }): Promise<ShadowJournalRecord[]> {
    const orderFn =
      options?.orderBy === 'asc'
        ? sql`${shadowJournalIndexTable.date} ASC`
        : sql`${shadowJournalIndexTable.date} DESC`

    let query = this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(this.vaultFilter())
      .orderBy(orderFn)

    if (options?.limit) query = query.limit(options.limit) as any
    if (options?.offset) query = query.offset(options.offset) as any

    return await query
  }

  async count(): Promise<number> {
    const result = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(shadowJournalIndexTable)
      .where(this.withVault(this.journalPathNotUnderSkippedDirs()))
    return result[0]?.count || 0
  }

  async getActivityData(year?: number): Promise<{ date: string; count: number }[]> {
    try {
      const rows = await this.database
        .select({
          date: shadowJournalIndexTable.date,
          count: sql<number>`1`
        })
        .from(shadowJournalIndexTable)
        .where(
          year != null
            ? this.withVault(
                this.journalPathNotUnderSkippedDirs(),
                gte(shadowJournalIndexTable.date, `${year}-01-01`),
                lte(shadowJournalIndexTable.date, `${year}-12-31`)
              )
            : this.withVault(this.journalPathNotUnderSkippedDirs())
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
