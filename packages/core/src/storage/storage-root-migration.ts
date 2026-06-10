import type { IFileSystem } from '../fs/file-system.types'
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
      await fileSystem.copyFile(`${source}/${name}`, `${staging}/${name}`)
    }

    const staged = await fileSystem.readdir(staging)
    for (const name of staged) {
      onProgress?.(name)
      const dest = `${target}/${name}`
      await fileSystem.copyFile(`${staging}/${name}`, dest)
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
