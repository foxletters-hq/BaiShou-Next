import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'

export async function cleanupLegacyVaultArtifacts(
  fileSystem: IFileSystem,
  vaultDir: string,
  options?: { preserveAgentSqlite?: boolean }
): Promise<void> {
  await purgeShadowIndexFilesInDirectory(fileSystem, path.join(vaultDir, '.baishou'))

  const filesToRemove = options?.preserveAgentSqlite
    ? ['baishou.sqlite']
    : ['agent.sqlite', 'baishou.sqlite']
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
 * - 各 Vault 下遗留的 per-vault shadow_index.db
 * - 全局 shadow_index_v2.db
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
