import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { NEXT_REGISTRY_FILENAME } from '../migration/legacy-migration.shared'

/** 存储根下不作为工作区目录的文件夹名 */
const ROOT_VAULT_SKIP_DIR_NAMES = new Set([
  'node_modules',
  'snapshots',
  'temp',
  '.snapshots',
  'config',
  'assistant_avatars',
  'database',
  'user-data'
])

/** 列出存储根下可作为工作区的子目录名（与增量同步扫描范围一致） */
export async function listDiskVaultFolderNames(
  fileSystem: IFileSystem,
  rootDir: string
): Promise<string[]> {
  const folders: string[] = []
  try {
    const names = await fileSystem.readdir(rootDir)
    for (const name of names) {
      if (name.startsWith('.')) continue
      if (ROOT_VAULT_SKIP_DIR_NAMES.has(name)) continue
      if (name === NEXT_REGISTRY_FILENAME) continue
      const full = path.join(rootDir, name)
      const stat = await fileSystem.stat(full).catch(() => null)
      if (stat?.isDirectory) {
        folders.push(name)
      }
    }
  } catch {
    // ignore unreadable root
  }
  return folders
}
