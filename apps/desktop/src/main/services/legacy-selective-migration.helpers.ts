import i18n from 'i18next'
import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'
import {
  LEGACY_MIGRATION_SECTION_LABELS,
  resolveLegacyAvatarCandidates
} from '@baishou/core/shared'
import type {
  LegacyMigrationImportSelection,
  LegacyMigrationSectionId,
  LegacyMigrationImportSectionResult,
  LegacyMigrationSectionPreview
} from '@baishou/shared'
import { resolveFlutterDocumentsAvatarsDir } from './flutter-legacy-paths.service'

export type ProgressFn = (event: import('@baishou/shared').LegacyMigrationProgressEvent) => void

export interface LegacyAssistantRow {
  id: string
  name: string
  emoji: string | null
  description: string | null
  avatar_path: string | null
  system_prompt: string | null
  is_default: number
  context_window: number
  provider_id: string | null
  model_id: string | null
  compress_token_threshold: number
  compress_keep_turns: number
  sort_order: number
}

export interface LegacySessionRow {
  id: string
  title: string
  vault_name: string
  assistant_id: string | null
  is_pinned: number
  system_prompt: string | null
  provider_id: string
  model_id: string
}

export interface LegacyMessageRow {
  id: string
  session_id: string
  role: string
  order_index: number
  is_summary: number
  ask_id: string | null
  provider_id: string | null
  model_id: string | null
  input_tokens: number | null
  output_tokens: number | null
  cost_micros: number | null
}

export interface LegacyPartRow {
  id: string
  message_id: string
  session_id: string
  type: string
  data: string
}

export interface LegacyBaishouDiaryRow {
  dateKey: string
  content: string
  tags?: string
  weather?: string
  mood?: string
  location?: string
  locationDetail?: string
  isFavorite?: boolean
}

export function emptySectionResult(
  id: LegacyMigrationSectionId
): LegacyMigrationImportSectionResult {
  return { id, success: 0, skipped: 0, failed: 0, errors: [] }
}

export function readLegacySqlite<T>(dbPath: string, sql: string, param?: string): T[] {
  if (!existsSync(dbPath)) return []
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    if (param !== undefined) {
      return db.prepare(sql).all(param) as T[]
    }
    return db.prepare(sql).all() as T[]
  } finally {
    db.close()
  }
}

export function legacyDateToDateKey(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const match = value.match(/(\d{4}-\d{2}-\d{2})/)
    return match?.[1] ?? null
  }
  if (typeof value === 'number') {
    const ms = value < 10000000000 ? value * 1000 : value
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return null
}

export function readLegacyBaishouDiaries(dbPath: string): LegacyBaishouDiaryRow[] {
  if (!existsSync(dbPath)) return []
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='diaries'")
      .get() as { name: string } | undefined
    if (!table) return []

    const columns = db.prepare("PRAGMA table_info('diaries')").all() as Array<{ name: string }>
    const names = new Set(columns.map((c) => c.name))
    if (!names.has('content')) return []

    const dateCol = names.has('date') ? 'date' : names.has('created_at') ? 'created_at' : null
    if (!dateCol) return []

    const selectCols = [dateCol, 'content']
    for (const col of ['tags', 'weather', 'mood', 'location', 'location_detail', 'is_favorite']) {
      if (names.has(col)) selectCols.push(col)
    }

    const rows = db.prepare(`SELECT ${selectCols.join(', ')} FROM diaries`).all() as Record<
      string,
      unknown
    >[]

    const out: LegacyBaishouDiaryRow[] = []
    for (const row of rows) {
      const dateKey = legacyDateToDateKey(row[dateCol])
      const content = String(row.content ?? '').trim()
      if (!dateKey || !content) continue
      out.push({
        dateKey,
        content,
        tags: row.tags != null ? String(row.tags) : undefined,
        weather: row.weather != null ? String(row.weather) : undefined,
        mood: row.mood != null ? String(row.mood) : undefined,
        location: row.location != null ? String(row.location) : undefined,
        locationDetail: row.location_detail != null ? String(row.location_detail) : undefined,
        isFavorite: row.is_favorite === 1 || row.is_favorite === true
      })
    }
    return out
  } finally {
    db.close()
  }
}

export function resolveUserAvatarCandidates(
  sp: Record<string, unknown> | null,
  sourceDir: string,
  options?: { includeMachineAvatarPaths?: boolean }
): string[] {
  const includeMachinePaths = options?.includeMachineAvatarPaths ?? true
  return [
    ...new Set(
      resolveLegacyAvatarCandidates(sp, sourceDir, {
        includeMachinePaths,
        documentsAvatarsDir: includeMachinePaths ? resolveFlutterDocumentsAvatarsDir() : undefined
      })
    )
  ].filter((p) => existsSync(p))
}

export function normalizeImportSelection(
  selection: LegacyMigrationImportSelection
): LegacyMigrationImportSelection {
  const normalized: LegacyMigrationImportSelection = { ...selection }
  if (normalized.chatMessages && !normalized.assistants) {
    normalized.assistants = true
  }
  return normalized
}

export function validateImportSelection(selection: unknown): LegacyMigrationImportSelection {
  if (!selection || typeof selection !== 'object') {
    throw new Error(
      i18n.t(
        'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L230',
        '无效的导入选项'
      )
    )
  }
  const src = selection as Record<string, unknown>
  const keys: Array<keyof LegacyMigrationImportSelection> = [
    'avatar',
    'identityCards',
    'config',
    'diaries',
    'assistants',
    'chatMessages',
    'workspaces'
  ]
  const out: LegacyMigrationImportSelection = {}
  for (const key of keys) {
    if (src[key] === true) out[key] = true
  }
  if (!Object.values(out).some(Boolean)) {
    throw new Error(
      i18n.t(
        'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L247',
        '请至少选择一个导入板块'
      )
    )
  }
  return normalizeImportSelection(out)
}

export function buildEmptySections(warning: string): LegacyMigrationSectionPreview[] {
  return (Object.keys(LEGACY_MIGRATION_SECTION_LABELS) as LegacyMigrationSectionId[]).map((id) => ({
    id,
    label: LEGACY_MIGRATION_SECTION_LABELS[id],
    detected: false,
    count: 0,
    sizeBytes: 0,
    sizeLabel: '0 MB',
    samples: [],
    warnings: [warning],
    importable: false
  }))
}
