/**
 * 影子索引记录（对齐原版 journals_index 表的查询结果）
 */
export interface ShadowJournalRecord {
  id: number
  vaultName: string
  filePath: string
  date: string
  createdAt: string
  updatedAt: string
  contentHash: string
  weather: string | null
  mood: string | null
  location: string | null
  locationDetail: string | null
  isFavorite: boolean
  hasMedia: boolean
}

/**
 * Upsert 参数
 */
export interface UpsertShadowIndexPayload {
  id?: number
  /** 可选；未提供时由 Repository 构造参数注入 */
  vaultName?: string
  filePath: string
  date: string
  createdAt: string
  updatedAt: string
  contentHash: string
  weather?: string | null
  mood?: string | null
  location?: string | null
  locationDetail?: string | null
  isFavorite: boolean
  hasMedia: boolean
  /** raw markdown content 用于 FTS 索引 */
  rawContent: string
  /** 逗号分隔的标签字符串 */
  tags: string
  /** frontmatter tag_colors JSON */
  tagColors?: string | null
}

/**
 * 影子全文搜索结果
 */
export interface ShadowFTSResult {
  rowid: number
  contentSnippet: string
  tags: string
  rankScore: number
  /** 影子索引行（查询时 JOIN 带回，避免按 ID 二次查找） */
  indexRow?: ShadowJournalRow
}

export type ShadowJournalRow = ShadowJournalRecord & {
  rawContent?: string | null
  tags?: string | null
  tagColors?: string | null
}

export interface DiaryListFilterOptions {
  year?: number
  month?: number
  favorite?: boolean
  weathers?: string[]
  moods?: string[]
  limit?: number
  offset?: number
  orderBy?: 'asc' | 'desc'
}
