import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import {
  normalizeSqliteAttachPath,
  scanLegacyDatabases,
  type RawSqlExecutor
} from './legacy-migration.shared'
import { countArchiveMarkdownUnderArchivesDir } from '../vault/archive-files.util'

interface LegacySummaryRow {
  id: number
  type: string
  startDate: Date
  endDate: Date
  content: string
  generatedAt: Date
  sourceIds: string[]
}

function legacyTimestampToDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    return new Date(value < 1e12 ? value * 1000 : value)
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

function formatSummaryFileName(startDate: Date): string {
  const year = startDate.getFullYear()
  const month = String(startDate.getMonth() + 1).padStart(2, '0')
  const day = String(startDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}.md`
}

function summaryTypeFolder(type: string): string {
  const normalized = type.trim().toLowerCase()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

/** 与旧版 Flutter SummaryFileService.writeSummary 一致的物理文件格式 */
export function buildFlutterLegacySummaryMarkdown(row: LegacySummaryRow): string {
  const sourceIdsYaml =
    row.sourceIds.length === 0
      ? 'sourceIds: []'
      : `sourceIds:\n${row.sourceIds.map((id) => `  - ${JSON.stringify(id)}`).join('\n')}`

  const yaml = [
    `id: ${row.id}`,
    `type: ${row.type.toLowerCase()}`,
    `startDate: ${row.startDate.toISOString()}`,
    `endDate: ${row.endDate.toISOString()}`,
    `generatedAt: ${row.generatedAt.toISOString()}`,
    sourceIdsYaml
  ].join('\n')

  return `---\n${yaml}\n---\n${row.content.trim()}`
}

export async function resolveLegacyBaishouDbPathsForVault(
  fileSystem: IFileSystem,
  sourceRoot: string,
  legacyVaultName: string
): Promise<string[]> {
  const vaultDb = path.join(sourceRoot, legacyVaultName, '.baishou', 'baishou.sqlite')
  if (await fileSystem.exists(vaultDb)) {
    return [vaultDb]
  }
  const rootDb = path.join(sourceRoot, '.baishou', 'baishou.sqlite')
  if (await fileSystem.exists(rootDb)) {
    return [rootDb]
  }
  const { baishouDbs } = await scanLegacyDatabases(fileSystem, sourceRoot)
  return baishouDbs
}

function parseLegacySummaryRow(row: Record<string, unknown>): LegacySummaryRow | null {
  const type = String(row.type ?? '')
    .trim()
    .toLowerCase()
  if (!type) return null
  const content = String(row.content ?? '').trim()
  if (!content) return null

  const sourceIdsRaw = row.source_ids
  let sourceIds: string[] = []
  if (typeof sourceIdsRaw === 'string' && sourceIdsRaw.trim()) {
    sourceIds = sourceIdsRaw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return {
    id: Number(row.id ?? 0),
    type,
    startDate: legacyTimestampToDate(row.start_date),
    endDate: legacyTimestampToDate(row.end_date),
    content,
    generatedAt: legacyTimestampToDate(row.generated_at),
    sourceIds
  }
}

export async function queryLegacySummaryRows(
  fileSystem: IFileSystem,
  sourceRoot: string,
  legacyVaultName: string,
  sqliteClient: unknown,
  executeRawSql: RawSqlExecutor,
  prepareSqliteAttachPath?: (dbPath: string) => Promise<string>
): Promise<{ rows: LegacySummaryRow[]; errors: string[] }> {
  const dbPaths = await resolveLegacyBaishouDbPathsForVault(fileSystem, sourceRoot, legacyVaultName)
  const uniquePaths = [...new Set(dbPaths.map((p) => normalizeSqliteAttachPath(p)))]
  const rows: LegacySummaryRow[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  for (let i = 0; i < uniquePaths.length; i++) {
    const alias = `legacy_baishou_${i}`
    const rawAttachPath = uniquePaths[i]!
    try {
      const attachPath = prepareSqliteAttachPath
        ? await prepareSqliteAttachPath(rawAttachPath)
        : rawAttachPath
      console.info('[VersionMigration][summary-db] attach', {
        legacyVaultName,
        rawAttachPath,
        attachPath
      })
      await executeRawSql(sqliteClient, `ATTACH DATABASE '${attachPath}' AS ${alias}`)
      const tableInfo = await executeRawSql(sqliteClient, `PRAGMA ${alias}.table_info('summaries')`)
      if (!tableInfo.rows.length) {
        console.info('[VersionMigration][summary-db] no summaries table', {
          legacyVaultName,
          rawAttachPath
        })
        await executeRawSql(sqliteClient, `DETACH DATABASE ${alias}`)
        continue
      }

      const result = await executeRawSql(sqliteClient, `SELECT * FROM ${alias}.summaries`)
      console.info('[VersionMigration][summary-db] rows', {
        legacyVaultName,
        rawAttachPath,
        rows: result.rows.length
      })
      for (const raw of result.rows) {
        const parsed = parseLegacySummaryRow(raw)
        if (!parsed) continue
        const key = `${parsed.type}_${parsed.startDate.toISOString()}_${parsed.endDate.toISOString()}`
        if (seen.has(key)) continue
        seen.add(key)
        rows.push(parsed)
      }
      await executeRawSql(sqliteClient, `DETACH DATABASE ${alias}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[VersionMigration][summary-db] failed', {
        legacyVaultName,
        rawAttachPath,
        alias,
        error: message
      })
      errors.push(message)
      try {
        await executeRawSql(sqliteClient, `DETACH DATABASE ${alias}`)
      } catch {
        // ignore
      }
    }
  }

  return { rows, errors }
}

export async function importLegacySqlSummariesForVault(deps: {
  fileSystem: IFileSystem
  sourceRoot: string
  targetRoot: string
  legacyVaultName: string
  sqliteClient: unknown
  executeRawSql: RawSqlExecutor
  resolveTargetVaultName: (legacyVaultName: string) => Promise<string>
  prepareSqliteAttachPath?: (dbPath: string) => Promise<string>
  onProgress?: (message: string) => void
}): Promise<{ imported: number; skipped: number; failed: number; failureSamples?: string[] }> {
  const { rows, errors } = await queryLegacySummaryRows(
    deps.fileSystem,
    deps.sourceRoot,
    deps.legacyVaultName,
    deps.sqliteClient,
    deps.executeRawSql,
    deps.prepareSqliteAttachPath
  )

  if (rows.length === 0) {
    return {
      imported: 0,
      skipped: 0,
      failed: errors.length > 0 ? 1 : 0,
      failureSamples: errors.length > 0 ? errors.slice(0, 8) : undefined
    }
  }

  const targetVault = await deps.resolveTargetVaultName(deps.legacyVaultName)
  const targetArchives = path.join(deps.targetRoot, targetVault, 'Archives')
  let imported = 0
  let skipped = 0
  let failed = 0
  const failureSamples: string[] = []

  for (const row of rows) {
    const typeDir = path.join(targetArchives, summaryTypeFolder(row.type))
    const filePath = path.join(typeDir, formatSummaryFileName(row.startDate))
    deps.onProgress?.(filePath)

    try {
      await deps.fileSystem.mkdir(typeDir, { recursive: true })
      if (await deps.fileSystem.exists(filePath)) {
        const existing = await deps.fileSystem.readFile(filePath, 'utf8')
        const expected = buildFlutterLegacySummaryMarkdown(row)
        if (existing.trim() === expected.trim()) {
          skipped += 1
          continue
        }
      }
      await deps.fileSystem.writeFile(filePath, buildFlutterLegacySummaryMarkdown(row), 'utf8')
      imported += 1
    } catch (error) {
      failed += 1
      if (failureSamples.length < 12) {
        const message = error instanceof Error ? error.message : String(error)
        failureSamples.push(`总结 ${row.type} ${formatSummaryFileName(row.startDate)}: ${message}`)
      }
    }
  }

  return {
    imported,
    skipped,
    failed,
    failureSamples: failureSamples.length > 0 ? failureSamples : undefined
  }
}

export async function countLegacySummariesForVault(
  fileSystem: IFileSystem,
  sourceRoot: string,
  legacyVaultName: string,
  sqliteClient: unknown,
  executeRawSql: RawSqlExecutor,
  prepareSqliteAttachPath?: (dbPath: string) => Promise<string>
): Promise<number> {
  const { rows } = await queryLegacySummaryRows(
    fileSystem,
    sourceRoot,
    legacyVaultName,
    sqliteClient,
    executeRawSql,
    prepareSqliteAttachPath
  )
  return rows.length
}

export async function countLegacyArchiveSourcesForVault(
  fileSystem: IFileSystem,
  sourceRoot: string,
  legacyVaultName: string,
  sqliteClient: unknown,
  executeRawSql: RawSqlExecutor,
  prepareSqliteAttachPath?: (dbPath: string) => Promise<string>
): Promise<{ fileCount: number; sqlCount: number }> {
  const archivesDir = path.join(sourceRoot, legacyVaultName, 'Archives')
  const fileCount = await countArchiveMarkdownUnderArchivesDir(fileSystem, archivesDir)
  const sqlCount = await countLegacySummariesForVault(
    fileSystem,
    sourceRoot,
    legacyVaultName,
    sqliteClient,
    executeRawSql,
    prepareSqliteAttachPath
  )
  return { fileCount, sqlCount }
}
