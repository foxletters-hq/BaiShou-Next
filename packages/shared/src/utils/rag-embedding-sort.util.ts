/**
 * memory_embeddings 分页排序键（毫秒）。
 * 优先 source_created_at（日记 date），兼容历史秒/毫秒混写。
 */
export const EMBEDDING_SOURCE_SORT_MILLIS_SQL = `CASE
  WHEN source_created_at IS NOT NULL THEN
    CASE WHEN source_created_at > 1000000000000 THEN source_created_at ELSE source_created_at * 1000 END
  ELSE
    CASE WHEN created_at > 1000000000000 THEN created_at ELSE created_at * 1000 END
END`

export const EMBEDDING_SOURCE_SORT_ORDER_SQL = `${EMBEDDING_SOURCE_SORT_MILLIS_SQL} DESC, embedding_id DESC`
