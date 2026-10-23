import { memoryEmbeddingsTable } from '@baishou/database-desktop'
import type { RagVectorKind } from '@baishou/shared'
import { GRAPH_NODE_SOURCE_TYPE, MEMORY_SOURCE_TYPE } from '@baishou/shared'
import { eq, and, or, sql } from 'drizzle-orm'

/** 嵌入迁移备份表名 */
export const BACKUP_TABLE = 'memory_embeddings_backup'
/** 迁移失败回滚快照表（含完整向量） */
export const ROLLBACK_TABLE = 'memory_embeddings_rollback'
/** 清空前自动备份表名 */
export const SAFETY_BACKUP_TABLE = 'memory_embeddings_safety_backup'

export function embeddingKindFilter(kind: RagVectorKind) {
  if (kind === 'diary') return eq(memoryEmbeddingsTable.sourceType, 'diary')
  if (kind === 'graph_node') return eq(memoryEmbeddingsTable.sourceType, GRAPH_NODE_SOURCE_TYPE)
  if (kind === 'manual') {
    return or(
      eq(memoryEmbeddingsTable.sourceType, 'manual'),
      and(
        eq(memoryEmbeddingsTable.sourceType, MEMORY_SOURCE_TYPE),
        sql`json_extract(${memoryEmbeddingsTable.metadataJson}, '$.sourceSessionId') IS NULL`
      )
    )
  }
  return and(
    eq(memoryEmbeddingsTable.sourceType, MEMORY_SOURCE_TYPE),
    sql`json_extract(${memoryEmbeddingsTable.metadataJson}, '$.sourceSessionId') IS NOT NULL`
  )
}

export function parseSafetyBackupCreatedAt(
  tableName: string,
  prefix = SAFETY_BACKUP_TABLE
): string {
  const match = tableName.match(new RegExp(`${prefix}-(.+)`))
  return match
    ? match[1].replace(/-/g, (m: string, offset: number) => {
        if (offset === 10) return 'T'
        if (offset === 13 || offset === 16) return ':'
        if (offset === 19) return '.'
        return m
      })
    : 'unknown'
}

export function isSafetyBackupTableName(tableName: string, prefix = SAFETY_BACKUP_TABLE): boolean {
  return tableName.startsWith(prefix)
}

let embeddingWriteMutex: Promise<void> = Promise.resolve()

export async function withEmbeddingWriteLock<T>(action: () => Promise<T>): Promise<T> {
  const previous = embeddingWriteMutex
  let release!: () => void
  embeddingWriteMutex = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await action()
  } finally {
    release()
  }
}
