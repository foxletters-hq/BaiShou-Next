import { buildJournalTreeSkipSqlLikeClauses } from '@baishou/shared'
import { eq, sql, and } from 'drizzle-orm'
import { shadowJournalIndexTable } from '../schema/shadow-index'
import type { AppDatabase } from '../types'
import type { ShadowJournalRow } from './shadow-index.repository.types'

export class ShadowIndexQueryContext {
  constructor(
    readonly database: AppDatabase,
    readonly vaultId: string
  ) {}

  vaultFilter() {
    return eq(shadowJournalIndexTable.vaultId, this.vaultId)
  }

  withVault(...conditions: Parameters<typeof and>) {
    const extra = conditions.filter(Boolean)
    return extra.length > 0 ? and(this.vaultFilter(), ...extra) : this.vaultFilter()
  }

  /** 排除 Archives 等总结子目录中误入影子索引的记录 */
  journalPathNotUnderSkippedDirs() {
    const clauses = buildJournalTreeSkipSqlLikeClauses('file_path').map((clause) => sql.raw(clause))
    return and(...clauses)
  }

  mapSqlRowToIndexRow(row: Record<string, unknown>): ShadowJournalRow {
    const fileMtimeMs = row.file_mtime_ms ?? row.fileMtimeMs
    const fileSize = row.file_size ?? row.fileSize
    return {
      id: Number(row.rowid ?? row.id),
      vaultId: String(row.vault_id ?? row.vaultId ?? this.vaultId),
      filePath: String(row.file_path ?? row.filePath ?? ''),
      date: String(row.date ?? ''),
      createdAt: String(row.created_at ?? row.createdAt ?? ''),
      updatedAt: String(row.updated_at ?? row.updatedAt ?? ''),
      contentHash: String(row.content_hash ?? row.contentHash ?? ''),
      fileMtimeMs: fileMtimeMs == null ? null : Number(fileMtimeMs),
      fileSize: fileSize == null ? null : Number(fileSize),
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
}
