import { expandWeatherFilterValues } from '@baishou/shared'
import { eq, sql, like, and, inArray, desc, asc, gte, lte } from 'drizzle-orm'
import { shadowJournalIndexTable } from '../schema/shadow-index'
import type { AppDatabase } from '../types'
import { cleanSegmentedSnippet, segmentChinese } from './shadow-index.repository.text'
import type {
  DiaryListFilterOptions,
  ShadowFTSResult,
  ShadowJournalRecord,
  ShadowJournalRow
} from './shadow-index.repository.types'

export class ShadowIndexQueryOps {
  constructor(private readonly database: AppDatabase) {}

  async findByDatePrefix(dayStr: string): Promise<ShadowJournalRecord[]> {
    return await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(like(shadowJournalIndexTable.date, `${dayStr}%`))
  }

  async findByDateRange(startIso: string, endIso: string): Promise<ShadowJournalRecord[]> {
    return await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(
        and(gte(shadowJournalIndexTable.date, startIso), lte(shadowJournalIndexTable.date, endIso))
      )
      .orderBy(sql`${shadowJournalIndexTable.date} ASC`)
  }

  async getHashByDate(dateIso: string): Promise<string | null> {
    const rows = await this.database
      .select({ contentHash: shadowJournalIndexTable.contentHash })
      .from(shadowJournalIndexTable)
      .where(eq(shadowJournalIndexTable.date, dateIso))
      .limit(1)

    return rows[0]?.contentHash ?? null
  }

  async getAllRecords(): Promise<Pick<ShadowJournalRecord, 'id' | 'date' | 'filePath'>[]> {
    return await this.database
      .select({
        id: shadowJournalIndexTable.id,
        date: shadowJournalIndexTable.date,
        filePath: shadowJournalIndexTable.filePath
      })
      .from(shadowJournalIndexTable)
  }

  async searchFTS(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ShadowFTSResult[]> {
    if (!query || query.trim().length === 0) return []
    const cleanedQuery = query.replace(/"/g, ' ').trim()
    if (!cleanedQuery) return []

    // 按照空白切分多 Term 逻辑
    const rawTerms = cleanedQuery.split(/\s+/).filter(Boolean)
    if (rawTerms.length === 0) return []

    // 1. 构造 FTS Match 表达式 (AND 逻辑)
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

    let ftsResults: ShadowFTSResult[] = []
    if (ftsTokens.length > 0) {
      const ftsMatchExpr = ftsTokens.join(' ')
      try {
        const rawResults = (await this.database.all(
          sql`
            SELECT 
              rowid,
              snippet(journals_fts, 0, '<b>', '</b>', '...', 64) as content_snippet,
              tags,
              rank as fts_rank
            FROM journals_fts 
            WHERE journals_fts MATCH ${ftsMatchExpr}
            ORDER BY fts_rank ASC
            LIMIT ${limit + offset}
          `
        )) as any[]

        ftsResults = rawResults.map((row) => ({
          rowid: row.rowid,
          contentSnippet: cleanSegmentedSnippet(row.content_snippet),
          tags: cleanSegmentedSnippet(row.tags),
          rankScore: row.fts_rank
        }))
      } catch (e: any) {
        console.warn('[ShadowIndex] FTS 搜索失败 (非阻塞):', e.message)
      }
    }

    // 2. 并行执行 LIKE 兜底检索
    let likeRows: Array<{ rowid: number; rawContent: string | null; tags: string | null }> = []
    try {
      const likeQueries = rawTerms.map((term) => {
        const escaped = `%${term.replace(/[%_\\]/g, '\\$&')}%`
        return sql`(raw_content LIKE ${escaped} ESCAPE '\\' OR tags LIKE ${escaped} ESCAPE '\\')`
      })

      // 查询 journals_index 表
      const rows = (await this.database
        .select({
          rowid: shadowJournalIndexTable.id,
          rawContent: shadowJournalIndexTable.rawContent,
          tags: shadowJournalIndexTable.tags
        })
        .from(shadowJournalIndexTable)
        .where(and(...likeQueries))
        .limit(limit + offset)) as any[]

      if (rows) {
        likeRows = rows
      }
    } catch (e: any) {
      console.warn('[ShadowIndex] LIKE 搜索失败 (非阻塞):', e.message)
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
      if (seenIds.has(row.rowid)) continue
      seenIds.add(row.rowid)

      const snippet = generateLikeSnippet(row.rawContent || '', rawTerms)
      const tagsSnippet = generateLikeTagsSnippet(row.tags || '', rawTerms)

      mergedResults.push({
        rowid: row.rowid,
        contentSnippet: snippet,
        tags: tagsSnippet,
        rankScore: 9999
      })
    }

    return mergedResults.slice(offset, offset + limit)
  }

  private buildListFilterWhere(options: DiaryListFilterOptions) {
    const conditions: any[] = []

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

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  async listFiltered(options: DiaryListFilterOptions = {}): Promise<ShadowJournalRow[]> {
    const where = this.buildListFilterWhere(options)
    const orderFn =
      options.orderBy === 'asc'
        ? asc(shadowJournalIndexTable.date)
        : desc(shadowJournalIndexTable.date)

    let query = this.database.select().from(shadowJournalIndexTable).orderBy(orderFn)
    if (where) query = query.where(where) as typeof query
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
    let query = this.database.select({ count: sql<number>`count(*)` }).from(shadowJournalIndexTable)
    if (where) query = query.where(where) as typeof query
    const result = await query
    return result[0]?.count || 0
  }

  async findByIds(ids: number[]): Promise<ShadowJournalRow[]> {
    if (ids.length === 0) return []
    return (await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(inArray(shadowJournalIndexTable.id, ids))) as ShadowJournalRow[]
  }

  async findById(id: number): Promise<ShadowJournalRecord | null> {
    const rows = await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(eq(shadowJournalIndexTable.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  async findByDate(dateIso: string): Promise<ShadowJournalRecord | null> {
    const rows = await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(eq(shadowJournalIndexTable.date, dateIso))
      .limit(1)
    return rows[0] ?? null
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
      ORDER BY i.date ${direction}
    `
    if (limit > 0) queryStr = sql`${queryStr} LIMIT ${limit}`
    if (offset > 0) queryStr = sql`${queryStr} OFFSET ${offset}`

    try {
      interface RawFTSRow {
        id: number
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

    let query = this.database.select().from(shadowJournalIndexTable).orderBy(orderFn)

    if (options?.limit) query = query.limit(options.limit) as any
    if (options?.offset) query = query.offset(options.offset) as any

    return await query
  }

  async count(): Promise<number> {
    const result = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(shadowJournalIndexTable)
    return result[0]?.count || 0
  }

  async getActivityData(year?: number): Promise<{ date: string; count: number }[]> {
    try {
      const rows =
        year != null
          ? ((await this.database.all(
              sql`SELECT date, 1 as count FROM journals_index WHERE date >= ${`${year}-01-01`} AND date <= ${`${year}-12-31`} ORDER BY date ASC`
            )) as { date: string; count: number }[])
          : ((await this.database.all(
              sql`SELECT date, 1 as count FROM journals_index ORDER BY date ASC`
            )) as { date: string; count: number }[])
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
