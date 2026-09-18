import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { shouldSkipStorageMigrationEntry } from '@baishou/shared'
import {
  LEGACY_AGENT_MERGE_TABLES,
  LEGACY_BAISHOUL_MERGE_TABLES,
  type RawSqlExecutor
} from './legacy-migration.constants'
import { dedupeSqlitePaths } from './legacy-migration.status'

export async function mergeLegacySqliteDatabases(
  client: unknown,
  executeRawSql: RawSqlExecutor,
  agentDbs: string[],
  baishouDbs: string[],
  options?: {
    includeMemoryEmbeddings?: boolean
    onTableError?: (tableName: string, error: unknown) => void
  }
): Promise<void> {
  const includeMemoryEmbeddings = options?.includeMemoryEmbeddings ?? false
  const agentTables = includeMemoryEmbeddings
    ? [...LEGACY_AGENT_MERGE_TABLES, 'memory_embeddings']
    : [...LEGACY_AGENT_MERGE_TABLES]

  const uniqueAgentDbs = dedupeSqlitePaths(agentDbs)
  const uniqueBaishouDbs = dedupeSqlitePaths(baishouDbs)

  async function mergeTable(alias: string, tableName: string): Promise<void> {
    const mainRows = await executeRawSql(client, `PRAGMA main.table_info('${tableName}')`)
    const mainCols = mainRows.rows.map((row) => String(row.name))

    let legacyRows
    try {
      legacyRows = await executeRawSql(client, `PRAGMA ${alias}.table_info('${tableName}')`)
    } catch {
      return
    }

    if (!legacyRows.rows.length) return
    const legacyCols = legacyRows.rows.map((row) => String(row.name))
    const intersectCols = mainCols.filter((col) => legacyCols.includes(col))
    if (intersectCols.length === 0) return

    const colsString = intersectCols.join(', ')
    const selectCols = intersectCols
      .map((col) => {
        if (tableName === 'summaries' && ['start_date', 'end_date', 'generated_at'].includes(col)) {
          return `CASE WHEN ${col} < 10000000000 THEN ${col} * 1000 ELSE ${col} END as ${col}`
        }
        return col
      })
      .join(', ')

    try {
      await executeRawSql(
        client,
        `INSERT OR IGNORE INTO main.${tableName} (${colsString}) SELECT ${selectCols} FROM ${alias}.${tableName}`
      )
    } catch (error) {
      options?.onTableError?.(tableName, error)
    }
  }

  await executeRawSql(client, 'PRAGMA foreign_keys=OFF')

  try {
    for (let i = 0; i < uniqueAgentDbs.length; i++) {
      const legacyDb = uniqueAgentDbs[i]!
      const alias = `legacy_agent_${i}`
      await executeRawSql(client, `ATTACH DATABASE '${legacyDb}' AS ${alias}`)
      for (const table of agentTables) {
        await mergeTable(alias, table)
      }
      await executeRawSql(client, `DETACH DATABASE ${alias}`)
    }

    for (let i = 0; i < uniqueBaishouDbs.length; i++) {
      const legacyDb = uniqueBaishouDbs[i]!
      const alias = `legacy_baishou_${i}`
      await executeRawSql(client, `ATTACH DATABASE '${legacyDb}' AS ${alias}`)
      for (const table of LEGACY_BAISHOUL_MERGE_TABLES) {
        await mergeTable(alias, table)
      }
      await executeRawSql(client, `DETACH DATABASE ${alias}`)
    }
  } finally {
    await executeRawSql(client, 'PRAGMA foreign_keys=ON').catch(() => undefined)
  }
}

/** 存储迁移中部分文件复制失败 */
export class StorageMigrationCopyError extends Error {
  readonly failedPaths: string[]

  constructor(failedPaths: string[]) {
    const preview = failedPaths.slice(0, 3).join(', ')
    const suffix = failedPaths.length > 3 ? ` (+${failedPaths.length - 3} more)` : ''
    super(`Failed to copy ${failedPaths.length} file(s): ${preview}${suffix}`)
    this.name = 'StorageMigrationCopyError'
    this.failedPaths = failedPaths
  }
}

export async function countMigrationTreeFiles(
  fileSystem: IFileSystem,
  src: string,
  options?: { skipEntryNames?: Iterable<string> }
): Promise<number> {
  const skipEntries = options?.skipEntryNames ? new Set(options.skipEntryNames) : null
  if (!(await fileSystem.exists(src))) return 0

  let isDirectory = false
  try {
    const stat = await fileSystem.stat(src)
    isDirectory = stat.isDirectory
  } catch {
    return 0
  }
  if (!isDirectory) return 1

  let count = 0
  const entries = await fileSystem.readdir(src)
  for (const entry of entries) {
    if (skipEntries?.has(entry)) continue
    const srcPath = path.join(src, entry)
    count += await countMigrationTreeFiles(fileSystem, srcPath, options)
  }
  return count
}

function isSamePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b)
}

export async function mergeDirectories(
  fileSystem: IFileSystem,
  src: string,
  dest: string,
  options?: {
    skipEntryNames?: Iterable<string>
    onEntry?: (entryPath: string) => void
  }
): Promise<string[]> {
  const failed: string[] = []
  const skipEntries = options?.skipEntryNames ? new Set(options.skipEntryNames) : null
  if (isSamePath(src, dest)) return failed
  if (!(await fileSystem.exists(src))) return failed

  let isDirectory = false
  try {
    const stat = await fileSystem.stat(src)
    isDirectory = stat.isDirectory
  } catch {
    return failed
  }
  if (!isDirectory) return failed

  await fileSystem.mkdir(dest, { recursive: true })
  const entries = await fileSystem.readdir(src)
  for (const entry of entries) {
    if (skipEntries?.has(entry) || shouldSkipStorageMigrationEntry(entry)) continue
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    let entryIsDirectory = false
    try {
      const stat = await fileSystem.stat(srcPath)
      entryIsDirectory = stat.isDirectory
    } catch {
      continue
    }
    if (entryIsDirectory) {
      failed.push(...(await mergeDirectories(fileSystem, srcPath, destPath, options)))
    } else {
      if (isSamePath(srcPath, destPath)) continue
      options?.onEntry?.(srcPath)
      try {
        await fileSystem.copyFile(srcPath, destPath)
      } catch {
        failed.push(srcPath)
      }
    }
  }
  return failed
}

/** 仅复制目标尚不存在的文件（不覆盖、不递归合并已存在文件内容） */
export async function mergeDirectoriesSkipExisting(
  fileSystem: IFileSystem,
  src: string,
  dest: string
): Promise<string[]> {
  const failed: string[] = []
  if (isSamePath(src, dest)) return failed
  if (!(await fileSystem.exists(src))) return failed

  let isDirectory = false
  try {
    const stat = await fileSystem.stat(src)
    isDirectory = stat.isDirectory
  } catch {
    return failed
  }
  if (!isDirectory) return failed

  await fileSystem.mkdir(dest, { recursive: true })
  const entries = await fileSystem.readdir(src)
  for (const entry of entries) {
    if (shouldSkipStorageMigrationEntry(entry)) continue
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    let entryIsDirectory = false
    try {
      const stat = await fileSystem.stat(srcPath)
      entryIsDirectory = stat.isDirectory
    } catch {
      continue
    }
    if (entryIsDirectory) {
      failed.push(...(await mergeDirectoriesSkipExisting(fileSystem, srcPath, destPath)))
    } else {
      if (isSamePath(srcPath, destPath) || (await fileSystem.exists(destPath))) {
        continue
      }
      try {
        await fileSystem.copyFile(srcPath, destPath)
      } catch {
        failed.push(srcPath)
      }
    }
  }
  return failed
}
