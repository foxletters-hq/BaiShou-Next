/**
 * 影子索引记录（对齐原版 journals_index 表的查询结果）
 */
export interface ShadowJournalRecord {
  id: number
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
}

/**
 * 影子全文搜索结果
 */
export interface ShadowFTSResult {
  rowid: number
  contentSnippet: string
  tags: string
  rankScore: number
}

export type ShadowJournalRow = ShadowJournalRecord & {
  rawContent?: string | null
  tags?: string | null
}

export interface DiaryListFilterOptions {
  year?: number
  month?: number
  favorite?: boolean
  weathers?: string[]
  limit?: number
  offset?: number
  orderBy?: 'asc' | 'desc'
}
