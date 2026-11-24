import type { IFileSystem } from '@baishou/core-mobile'
import { normalizeStoragePath } from './android-external-fs'
import { joinStoragePath } from './mobile-storage-path.util'

/** 将历史目录中的 snapshot_*.zip 迁移到当前快照目录，空目录随后清理 */
export async function migrateSnapshotsFromDirectory(
  fileSystem: IFileSystem,
  sourceDir: string,
  targetDir: string
): Promise<void> {
  try {
    const normalizedSource = normalizeStoragePath(sourceDir)
    const normalizedTarget = normalizeStoragePath(targetDir)
    if (normalizedSource === normalizedTarget || !(await fileSystem.exists(normalizedSource))) {
      return
    }

    const files = await fileSystem.readdir(normalizedSource)
    for (const name of files) {
      if (!name || !name.startsWith('snapshot_') || !name.endsWith('.zip')) continue
      const src = joinStoragePath(normalizedSource, name)
      const dest = joinStoragePath(normalizedTarget, name)
      if (await fileSystem.exists(dest)) continue
      try {
        await fileSystem.copyFile(src, dest)
        await fileSystem.unlink(src).catch(() => {})
      } catch (e) {
        console.warn('[StoragePath] Failed to migrate snapshot', name, e)
      }
    }

    const remaining = await fileSystem.readdir(normalizedSource).catch(() => [] as string[])
    if (remaining.length === 0) {
      await fileSystem.rm(normalizedSource, { recursive: true, force: true }).catch(() => {})
    }
  } catch (e) {
    console.warn('[StoragePath] Snapshot migration skipped', sourceDir, e)
  }
}
