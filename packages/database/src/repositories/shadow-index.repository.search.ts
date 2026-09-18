import { sql } from 'drizzle-orm'
import { shadowJournalIndexTable } from '../schema/shadow-index'
import {
  cleanSegmentedSnippet,
  segmentChinese,
  normalizeSearchQuery
} from './shadow-index.repository.text'
import type { ShadowFTSResult, ShadowJournalRow } from './shadow-index.repository.types'
import type { ShadowIndexQueryContext } from './shadow-index.repository.query-context'

export class ShadowIndexSearchOps {
  constructor(private readonly ctx: ShadowIndexQueryContext) {}

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
      const rows = (await this.ctx.database.all(
        sql`
          SELECT COUNT(*) as cnt
          FROM journals_fts
          INNER JOIN journals_index i ON i.id = journals_fts.rowid
          WHERE journals_fts MATCH ${terms.ftsMatchExpr}
            AND i.vault_id = ${this.ctx.vaultId}
        `
      )) as Array<{ cnt: number }>
      return Number(rows[0]?.cnt ?? 0)
    } catch (e: any) {
      console.warn('[ShadowIndex] FTS 计数失败 (非阻塞):', e.message)
      return 0
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
        const rawResults = (await this.ctx.database.all(
          sql`
            SELECT 
              journals_fts.rowid,
              i.vault_id,
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
              AND i.vault_id = ${this.ctx.vaultId}
            ORDER BY i.date DESC
            LIMIT ${needCount}
          `
        )) as any[]

        ftsResults = rawResults.map((row) => ({
          rowid: row.rowid,
          contentSnippet: cleanSegmentedSnippet(row.content_snippet),
          tags: cleanSegmentedSnippet(row.tags),
          rankScore: row.fts_rank,
          indexRow: this.ctx.mapSqlRowToIndexRow(row)
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

        const rows = (await this.ctx.database
          .select()
          .from(shadowJournalIndexTable)
          .where(this.ctx.withVault(...likeQueries))
          .orderBy(sql`${shadowJournalIndexTable.date} DESC`)
          .limit(needCount)) as ShadowJournalRow[]

        if (rows) {
          likeRows = rows
        }
      } catch (e: any) {
        console.warn('[ShadowIndex] LIKE 搜索失败 (非阻塞):', e.message)
      }
    }

    const mergedResults: ShadowFTSResult[] = [...ftsResults]
    const seenIds = new Set(ftsResults.map((r) => r.rowid))

    for (const row of likeRows) {
      if (seenIds.has(row.id)) continue
      seenIds.add(row.id)

      mergedResults.push({
        rowid: row.id,
        contentSnippet: generateLikeSnippet(row.rawContent || '', rawTerms),
        tags: generateLikeTagsSnippet(row.tags || '', rawTerms),
        rankScore: 9999,
        indexRow: row
      })
    }

    // 与日记列表一致：按日期倒序（新→旧），避免 FTS+LIKE 合并后乱序
    mergedResults.sort((a, b) => {
      const dateA = a.indexRow?.date ?? ''
      const dateB = b.indexRow?.date ?? ''
      if (dateA === dateB) return b.rowid - a.rowid
      return dateB.localeCompare(dateA)
    })

    return mergedResults.slice(offset, offset + limit)
  }
}

function generateLikeSnippet(content: string, terms: string[]): string {
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

function generateLikeTagsSnippet(tagsStr: string, terms: string[]): string {
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
