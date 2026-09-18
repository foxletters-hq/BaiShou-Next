import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { isFilesystemRootPath } from '../storage/workspace-root.util'
import { journalMarkdownExistsInTree } from '../journal/journal-files.util'
import {
  LEGACY_MIGRATION_STATUS_FILE,
  MIN_AGENT_SQLITE_BYTES_FOR_IMPORT
} from './legacy-migration.constants'
import { normalizeSqliteAttachPath } from './legacy-migration.status'

export async function hasFlutterLegacyStorageMarkers(
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
    }
  } catch {
    // ignore unreadable roots
  }

  return false
}

export async function isLegacyAppRoot(
  fileSystem: IFileSystem,
  sourceDir: string
): Promise<boolean> {
  if (await hasFlutterLegacyStorageMarkers(fileSystem, sourceDir)) {
    return true
  }

  // 盘符根目录仅接受强特征；避免把 D:\ 下任意含 Journals 的文件夹误判为白守根目录。
  if (isFilesystemRootPath(sourceDir)) {
    return false
  }

  try {
    const entries = await fileSystem.readdir(sourceDir)
    for (const name of entries) {
      if (name.startsWith('.') || name === LEGACY_MIGRATION_STATUS_FILE) continue
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

export function isVaultSpecificLegacyAgentDb(dbPath: string, legacyVaultName: string): boolean {
  const normalized = dbPath.replace(/\\/g, '/')
  return normalized.includes(`/${legacyVaultName}/.baishou/agent.sqlite`)
}

async function legacyAgentSqliteByteSize(fileSystem: IFileSystem, dbPath: string): Promise<number> {
  try {
    const stat = await fileSystem.stat(dbPath)
    return stat.isFile ? (stat.size ?? 0) : 0
  } catch {
    return 0
  }
}

/**
 * 解析某工作区版本迁移应 ATTACH 的 legacy agent.sqlite 路径。
 * 同时包含工作区库与全局 `.baishou/agent.sqlite`（Flutter 早期数据可能仅在全局）。
 * 工作区库若为空壳（体积过小）而全局库有数据，仍会返回全局库。
 */
export async function resolveLegacyAgentDbPathsForVault(
  fileSystem: IFileSystem,
  sourceRoot: string,
  legacyVaultName: string
): Promise<string[]> {
  const candidates: string[] = []
  const seen = new Set<string>()
  const push = (dbPath: string) => {
    const key = normalizeSqliteAttachPath(dbPath)
    if (seen.has(key)) return
    seen.add(key)
    candidates.push(dbPath)
  }

  push(path.join(sourceRoot, legacyVaultName, '.baishou', 'agent.sqlite'))
  push(path.join(sourceRoot, '.baishou', 'agent.sqlite'))

  const { agentDbs } = await scanLegacyDatabases(fileSystem, sourceRoot)
  for (const dbPath of agentDbs) {
    if (isVaultSpecificLegacyAgentDb(dbPath, legacyVaultName)) {
      push(dbPath)
    }
  }

  const existing: string[] = []
  for (const dbPath of candidates) {
    if (await fileSystem.exists(dbPath)) {
      existing.push(dbPath)
    }
  }
  if (existing.length === 0) return []

  const sized = await Promise.all(
    existing.map(async (dbPath) => ({
      dbPath,
      size: await legacyAgentSqliteByteSize(fileSystem, dbPath),
      vaultSpecific: isVaultSpecificLegacyAgentDb(dbPath, legacyVaultName)
    }))
  )

  const meaningful = sized.filter((entry) => entry.size >= MIN_AGENT_SQLITE_BYTES_FOR_IMPORT)
  if (meaningful.length === 0) {
    const largest = [...sized].sort((a, b) => b.size - a.size)[0]
    return largest ? [largest.dbPath] : existing
  }

  const vaultMeaningful = meaningful.filter((entry) => entry.vaultSpecific)
  const globalMeaningful = meaningful.filter((entry) => !entry.vaultSpecific)

  if (vaultMeaningful.length > 0) {
    return [...vaultMeaningful, ...globalMeaningful].map((entry) => entry.dbPath)
  }

  return globalMeaningful.map((entry) => entry.dbPath)
}

/** 仅扫描指定工作区与全局 `.baishou` 下的 legacy SQLite，避免全树递归扫到无关目录 */
export async function scanLegacyDatabasesForVaults(
  fileSystem: IFileSystem,
  sourceDir: string,
  vaultNames: string[]
): Promise<{ agentDbs: string[]; baishouDbs: string[] }> {
  const agentDbs: string[] = []
  const baishouDbs: string[] = []

  async function collectFromDir(dir: string): Promise<void> {
    const sub = await scanLegacyDatabases(fileSystem, dir)
    agentDbs.push(...sub.agentDbs)
    baishouDbs.push(...sub.baishouDbs)
  }

  const globalBaishouDir = path.join(sourceDir, '.baishou')
  if (await fileSystem.exists(globalBaishouDir)) {
    await collectFromDir(globalBaishouDir)
  }

  for (const vaultName of vaultNames) {
    const vaultBaishouDir = path.join(sourceDir, vaultName, '.baishou')
    if (await fileSystem.exists(vaultBaishouDir)) {
      await collectFromDir(vaultBaishouDir)
    }
  }

  return { agentDbs, baishouDbs }
}
