import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { stripStoragePathScheme } from '@baishou/shared'
import {
  LEGACY_MIGRATION_STATUS_FILE,
  type LegacyMigrationStatus
} from './legacy-migration.constants'

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

export async function stageLegacySqliteForAttach(
  fileSystem: IFileSystem,
  sourceDbPath: string,
  stagingDir: string
): Promise<string> {
  const rawSource = stripStoragePathScheme(sourceDbPath)
  const normalizedSource = rawSource.replace(/\\/g, '/')
  await fileSystem.mkdir(stagingDir, { recursive: true })

  const baseName = normalizedSource.split('/').pop() ?? 'agent.sqlite'
  const safeName = baseName.replace(/[^\w.-]/g, '_')
  let hash = 0
  for (let i = 0; i < normalizedSource.length; i++) {
    hash = (hash * 31 + normalizedSource.charCodeAt(i)) | 0
  }
  const stagedPath = path.join(stagingDir, `legacy_${Math.abs(hash)}_${safeName}`)

  await fileSystem.copyFile(rawSource, stagedPath)
  return normalizeSqliteAttachPath(stagedPath)
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
