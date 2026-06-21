import type { IFileSystem } from '../fs/file-system.types'
import { mergeDirectories, StorageMigrationCopyError } from '../migration/legacy-migration.shared'
import {
  isPathInsideStorageRoot,
  isSameStorageRoot,
  normalizeStorageRoot,
  shouldSkipStorageMigrationEntry,
  STORAGE_MIGRATION_STAGING_DIR
} from '@baishou/shared'

async function removePathRecursive(fileSystem: IFileSystem, targetPath: string): Promise<void> {
  if (!(await fileSystem.exists(targetPath))) return
  try {
    const stat = await fileSystem.stat(targetPath)
    if (stat.isDirectory) {
      const names = await fileSystem.readdir(targetPath)
      for (const name of names) {
        await removePathRecursive(fileSystem, `${targetPath}/${name}`)
      }
    }
  } catch {
    // fall through to unlink
  }
  await fileSystem.unlink(targetPath)
}

export async function copyStorageRootContents(
  fileSystem: IFileSystem,
  sourceRoot: string,
  targetRoot: string,
  onProgress?: (itemName: string) => void
): Promise<void> {
  const source = normalizeStorageRoot(sourceRoot)
  const target = normalizeStorageRoot(targetRoot)
  const staging = `${target}/${STORAGE_MIGRATION_STAGING_DIR}`

  if (isSameStorageRoot(source, target)) {
    throw new Error('SAME_PATH')
  }
  if (isPathInsideStorageRoot(target, source)) {
    throw new Error('TARGET_INSIDE_SOURCE')
  }

  if (!(await fileSystem.exists(source))) {
    throw new Error('SOURCE_NOT_FOUND')
  }

  await removePathRecursive(fileSystem, staging)
  await fileSystem.mkdir(staging, { recursive: true })

  const promoted: string[] = []

  try {
    const entries = await fileSystem.readdir(source)
    for (const name of entries) {
      if (shouldSkipStorageMigrationEntry(name)) continue
      onProgress?.(name)
      const srcPath = `${source}/${name}`
      const stagingPath = `${staging}/${name}`
      let isDirectory = false
      try {
        isDirectory = (await fileSystem.stat(srcPath)).isDirectory
      } catch {
        continue
      }
      if (isDirectory) {
        const failed = await mergeDirectories(fileSystem, srcPath, stagingPath)
        if (failed.length > 0) {
          throw new StorageMigrationCopyError(failed)
        }
      } else {
        try {
          await fileSystem.copyFile(srcPath, stagingPath)
        } catch {
          throw new StorageMigrationCopyError([srcPath])
        }
      }
    }

    const staged = await fileSystem.readdir(staging)
    for (const name of staged) {
      onProgress?.(name)
      const stagedPath = `${staging}/${name}`
      const dest = `${target}/${name}`
      let isDirectory = false
      try {
        isDirectory = (await fileSystem.stat(stagedPath)).isDirectory
      } catch {
        continue
      }
      if (isDirectory) {
        const failed = await mergeDirectories(fileSystem, stagedPath, dest)
        if (failed.length > 0) {
          throw new StorageMigrationCopyError(failed)
        }
      } else {
        try {
          await fileSystem.copyFile(stagedPath, dest)
        } catch {
          throw new StorageMigrationCopyError([stagedPath])
        }
      }
      promoted.push(dest)
    }
  } catch (error) {
    for (const path of [...promoted].reverse()) {
      try {
        await removePathRecursive(fileSystem, path)
      } catch {
        // best-effort rollback
      }
    }
    throw error
  } finally {
    try {
      await removePathRecursive(fileSystem, staging)
    } catch {
      // ignore staging cleanup errors
    }
  }
}

export async function targetDirectoryHasData(
  fileSystem: IFileSystem,
  targetRoot: string
): Promise<boolean> {
  const target = normalizeStorageRoot(targetRoot)
  if (!(await fileSystem.exists(target))) return false
  const entries = await fileSystem.readdir(target)
  return entries.some((name) => !shouldSkipStorageMigrationEntry(name))
}

export async function validateStorageDirectoryWritable(
  fileSystem: IFileSystem,
  dirPath: string
): Promise<boolean> {
  const normalized = normalizeStorageRoot(dirPath)
  const testFile = `${normalized}/.baishou_write_test`
  try {
    await fileSystem.mkdir(normalized, { recursive: true })
    await fileSystem.writeFile(testFile, 'ok')
    await fileSystem.unlink(testFile)
    return true
  } catch {
    return false
  }
}
