import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import {
  stripStoragePathScheme,
  LEGACY_UPGRADE_RAG_NOTICE_MAX,
  LEGACY_UPGRADE_RAG_PENDING_KEY,
  LEGACY_UPGRADE_RAG_NOTICE_COUNT_KEY
} from '@baishou/shared'
import { journalMarkdownExistsInTree } from '../journal/journal-files.util'
import { sanitizeVaultDirectoryName } from '../vault/vault-name.util'
import type { VaultInfo } from '../vault/vault.types'

export {
  LEGACY_UPGRADE_RAG_NOTICE_MAX,
  LEGACY_UPGRADE_RAG_PENDING_KEY,
  LEGACY_UPGRADE_RAG_NOTICE_COUNT_KEY
}

export const LEGACY_MIGRATION_STATUS_FILE = '.baishou_next_migration.json'
export const LEGACY_REGISTRY_RELATIVE = '.baishou/vault_registry.json'
export const NEXT_REGISTRY_FILENAME = 'vault_registry.json'

export const LEGACY_AGENT_MERGE_TABLES = [
  'agent_assistants',
  'agent_sessions',
  'agent_messages',
  'agent_parts',
  'compression_snapshots'
] as const

export const LEGACY_BAISHOUL_MERGE_TABLES = ['diaries', 'summaries'] as const

export type LegacyMigrationSource = 'flutter_desktop' | 'flutter_mobile' | 'flutter_zip'

export interface LegacyMigrationStatus {
  version: 1
  completedAt: string
  source: LegacyMigrationSource
  migrationCompleted: true
  installInstanceId: string
  ragSkipped: true
  ragReembedRequired: true
  vaultsMigrated: string[]
}

/** SQLite ATTACH 需要裸绝对路径，且需转义单引号 */
export function normalizeSqliteAttachPath(dbPath: string): string {
  let normalized = stripStoragePathScheme(dbPath).replace(/\\/g, '/')
  if (normalized.startsWith('/emulated/0')) {
    normalized = `/storage${normalized}`
  } else if (normalized.startsWith('emulated/0')) {
    normalized = `/storage/${normalized}`
  } else if (normalized.startsWith('storage/emulated/0')) {
    normalized = `/${normalized}`
  }
  return normalized.replace(/'/g, "''")
}

export function dedupeSqlitePaths(paths: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const dbPath of paths) {
    const key = normalizeSqliteAttachPath(dbPath)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(key)
  }
  return unique
}

export type RawSqlExecutor = (
  client: unknown,
  statement: string,
  args?: unknown[]
) => Promise<{ rows: Record<string, unknown>[] }>

export function resolveAgentDbPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'baishou_agent.db')
}

export function migrationStatusPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, LEGACY_MIGRATION_STATUS_FILE)
}

export async function readMigrationStatus(
  fileSystem: IFileSystem,
  workspaceRoot: string
): Promise<LegacyMigrationStatus | null> {
  const statusPath = migrationStatusPath(workspaceRoot)
  if (!(await fileSystem.exists(statusPath))) return null
  try {
    const raw = await fileSystem.readFile(statusPath, 'utf8')
    return JSON.parse(raw) as LegacyMigrationStatus
  } catch {
    return null
  }
}

export async function writeMigrationStatus(
  fileSystem: IFileSystem,
  workspaceRoot: string,
  status: LegacyMigrationStatus
): Promise<void> {
  const statusPath = migrationStatusPath(workspaceRoot)
  await fileSystem.writeFile(statusPath, JSON.stringify(status, null, 2), 'utf8')
}

export async function isMigrationCompleted(
  fileSystem: IFileSystem,
  workspaceRoot: string,
  installInstanceId?: string | null
): Promise<boolean> {
  const status = await readMigrationStatus(fileSystem, workspaceRoot)
  if (status?.version !== 1 || status.migrationCompleted !== true) {
    return false
  }
  if (!installInstanceId) {
    return true
  }
  if (!status.installInstanceId) {
    return false
  }
  return status.installInstanceId === installInstanceId
}

export async function isLegacyAppRoot(
  fileSystem: IFileSystem,
  sourceDir: string
): Promise<boolean> {
  const globalMarkers = [
    path.join(sourceDir, '.baishou', 'agent.sqlite'),
    path.join(sourceDir, '.baishou', 'vault_registry.json')
  ]
  for (const marker of globalMarkers) {
    if (await fileSystem.exists(marker)) return true
  }

  try {
    const entries = await fileSystem.readdir(sourceDir)
    for (const name of entries) {
      if (name.startsWith('.') || name === LEGACY_MIGRATION_STATUS_FILE) continue
      const vaultAgentDb = path.join(sourceDir, name, '.baishou', 'agent.sqlite')
      const vaultRegistry = path.join(sourceDir, name, '.baishou', 'baishou.sqlite')
      if ((await fileSystem.exists(vaultAgentDb)) || (await fileSystem.exists(vaultRegistry))) {
        return true
      }
      if (await vaultHasJournalMarkdownFiles(fileSystem, sourceDir, name)) {
        return true
      }
    }
  } catch {
    // ignore unreadable roots
  }

  return false
}

async function vaultHasJournalMarkdownFiles(
  fileSystem: IFileSystem,
  sourceDir: string,
  vaultName: string
): Promise<boolean> {
  const journalsDir = path.join(sourceDir, vaultName, 'Journals')
  return journalMarkdownExistsInTree(fileSystem, journalsDir)
}

export async function scanLegacyDatabases(
  fileSystem: IFileSystem,
  sourceDir: string
): Promise<{ agentDbs: string[]; baishouDbs: string[] }> {
  const agentDbs: string[] = []
  const baishouDbs: string[] = []

  async function scan(dir: string): Promise<void> {
    let entries: string[] = []
    try {
      entries = await fileSystem.readdir(dir)
    } catch {
      return
    }

    for (const name of entries) {
      const fullPath = path.join(dir, name)
      if (name === 'agent.sqlite') agentDbs.push(fullPath)
      if (name === 'baishou.sqlite') baishouDbs.push(fullPath)

      let isDirectory = false
      try {
        const stat = await fileSystem.stat(fullPath)
        isDirectory = stat.isDirectory
      } catch {
        continue
      }
      if (isDirectory) {
        await scan(fullPath)
      }
    }
  }

  await scan(sourceDir)
  return { agentDbs, baishouDbs }
}

export async function readLegacyVaultRegistry(
  fileSystem: IFileSystem,
  sourceDir: string
): Promise<Array<{ name: string; createdAt?: string; lastAccessedAt?: string }>> {
  const registryPath = path.join(sourceDir, ...LEGACY_REGISTRY_RELATIVE.split('/'))
  try {
    const raw = await fileSystem.readFile(registryPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => typeof item?.name === 'string')
      .map((item) => ({
        name: item.name as string,
        createdAt: item.createdAt,
        lastAccessedAt: item.lastAccessedAt
      }))
  } catch {
    return []
  }
}

export async function discoverVaultNames(
  fileSystem: IFileSystem,
  sourceDir: string
): Promise<string[]> {
  const fromRegistry = await readLegacyVaultRegistry(fileSystem, sourceDir)
  if (fromRegistry.length > 0) {
    return fromRegistry.map((v) => v.name)
  }

  const discovered: string[] = []
  try {
    const entries = await fileSystem.readdir(sourceDir)
    for (const name of entries) {
      if (name.startsWith('.') || name === LEGACY_MIGRATION_STATUS_FILE) continue
      const vaultDir = path.join(sourceDir, name)
      try {
        const stat = await fileSystem.stat(vaultDir)
        if (!stat.isDirectory) continue
      } catch {
        continue
      }
      const hasContent =
        (await fileSystem.exists(path.join(vaultDir, 'Journals'))) ||
        (await fileSystem.exists(path.join(vaultDir, 'Archives'))) ||
        (await fileSystem.exists(path.join(vaultDir, '.baishou', 'agent.sqlite')))
      if (hasContent) discovered.push(name)
    }
  } catch {
    // ignore
  }

  return discovered.length > 0 ? discovered : ['Personal']
}

export async function writeNextVaultRegistry(
  fileSystem: IFileSystem,
  targetRoot: string,
  vaultNames: string[],
  legacyRegistry: Array<{ name: string; createdAt?: string; lastAccessedAt?: string }> = []
): Promise<VaultInfo[]> {
  const now = new Date()
  const vaults: VaultInfo[] = vaultNames.map((name) => {
    const legacy = legacyRegistry.find((item) => item.name === name)
    return {
      name,
      path: path.join(targetRoot, sanitizeVaultDirectoryName(name)),
      createdAt: legacy?.createdAt ? new Date(legacy.createdAt) : now,
      lastAccessedAt: legacy?.lastAccessedAt ? new Date(legacy.lastAccessedAt) : now
    }
  })

  const registryFile = path.join(targetRoot, NEXT_REGISTRY_FILENAME)
  const serializable = vaults.map((vault) => ({
    name: vault.name,
    path: vault.path,
    createdAt: vault.createdAt.toISOString(),
    lastAccessedAt: vault.lastAccessedAt.toISOString()
  }))
  await fileSystem.mkdir(targetRoot, { recursive: true })
  await fileSystem.writeFile(registryFile, JSON.stringify(serializable, null, 2), 'utf8')
  return vaults
}

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

export async function mergeDirectories(
  fileSystem: IFileSystem,
  src: string,
  dest: string
): Promise<string[]> {
  const failed: string[] = []
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
      failed.push(...(await mergeDirectories(fileSystem, srcPath, destPath)))
    } else {
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
      if (await fileSystem.exists(destPath)) {
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

export async function cleanupLegacyVaultArtifacts(
  fileSystem: IFileSystem,
  vaultDir: string
): Promise<void> {
  await purgeShadowIndexFilesInDirectory(fileSystem, path.join(vaultDir, '.baishou'))

  const filesToRemove = ['agent.sqlite', 'baishou.sqlite']
  for (const fileName of filesToRemove) {
    try {
      await fileSystem.unlink(path.join(vaultDir, '.baishou', fileName))
    } catch {
      // ignore
    }
  }
}

const SHADOW_INDEX_BASE_NAMES = ['shadow_index.db', 'shadow_index_v2.db'] as const

/** 删除指定目录下的影子索引库及其 WAL/SHM（可重建缓存） */
export async function purgeShadowIndexFilesInDirectory(
  fileSystem: IFileSystem,
  directory: string
): Promise<void> {
  if (!(await fileSystem.exists(directory))) return

  for (const baseName of SHADOW_INDEX_BASE_NAMES) {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const filePath = path.join(directory, `${baseName}${suffix}`)
      await unlinkWithRetry(fileSystem, filePath)
    }
  }
}

async function unlinkWithRetry(
  fileSystem: IFileSystem,
  filePath: string,
  maxAttempts = 3
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (!(await fileSystem.exists(filePath))) return
      await fileSystem.unlink(filePath)
      return
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
    }
  }
}

/**
 * 归档导入后清理所有可重建的影子索引缓存：
 * - 各 Vault 下遗留的 per-vault shadow_index.db（Flutter v3）
 * - 全局 shadow_index_v2.db（BaiShou Next）
 */
export async function purgeImportedShadowIndexCaches(
  fileSystem: IFileSystem,
  options: { workspaceRoot: string; globalShadowDir?: string | null }
): Promise<void> {
  const { workspaceRoot, globalShadowDir } = options

  try {
    const entries = await fileSystem.readdir(workspaceRoot)
    for (const entry of entries) {
      if (!entry || entry.startsWith('.')) continue
      const vaultBaishou = path.join(workspaceRoot, entry, '.baishou')
      await purgeShadowIndexFilesInDirectory(fileSystem, vaultBaishou)
    }
  } catch {
    // ignore unreadable workspace
  }

  const rootBaishou = path.join(workspaceRoot, '.baishou')
  await purgeShadowIndexFilesInDirectory(fileSystem, rootBaishou)

  if (globalShadowDir) {
    await purgeShadowIndexFilesInDirectory(fileSystem, globalShadowDir)
  }
}
