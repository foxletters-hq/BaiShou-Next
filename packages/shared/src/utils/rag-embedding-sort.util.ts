/**
 * memory_embeddings 排序/筛选用时间戳（毫秒）。
 * 优先 source_created_at（日记 date），兼容历史秒/毫秒混写。
 */
export function embeddingSortMillisExpr(columnPrefix = ''): string {
  const sourceCreatedAt = `${columnPrefix}source_created_at`
  const createdAt = `${columnPrefix}created_at`
  return `CASE
  WHEN ${sourceCreatedAt} IS NOT NULL THEN
    CASE WHEN ${sourceCreatedAt} > 1000000000000 THEN ${sourceCreatedAt} ELSE ${sourceCreatedAt} * 1000 END
  ELSE
    CASE WHEN ${createdAt} > 1000000000000 THEN ${createdAt} ELSE ${createdAt} * 1000 END
END`
}

export const EMBEDDING_SOURCE_SORT_MILLIS_SQL = embeddingSortMillisExpr('')

export const EMBEDDING_SOURCE_SORT_ORDER_SQL = `${EMBEDDING_SOURCE_SORT_MILLIS_SQL} DESC, embedding_id DESC`

export interface EmbeddingMillisRange {
  startMs?: number
  endMs?: number
}

/** 生成 source_created_at / created_at 归一化后的毫秒范围 SQL 谓词（不含 WHERE/AND 前缀）。 */
export function buildEmbeddingMillisRangePredicates(
  range: EmbeddingMillisRange,
  columnPrefix = ''
): { sql: string; args: number[] } {
  const expr = embeddingSortMillisExpr(columnPrefix)
  const parts: string[] = []
  const args: number[] = []

  if (range.startMs != null) {
    parts.push(`(${expr}) >= ?`)
    args.push(range.startMs)
  }
  if (range.endMs != null) {
    parts.push(`(${expr}) <= ?`)
    args.push(range.endMs)
  }

  if (parts.length === 0) return { sql: '', args: [] }
  return { sql: parts.join(' AND '), args }
}
