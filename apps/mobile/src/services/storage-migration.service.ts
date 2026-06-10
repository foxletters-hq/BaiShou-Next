import type { IFileSystem } from '@baishou/core-mobile'
import {
  copyStorageRootContents as copyStorageRootContentsCore,
  targetDirectoryHasData as targetDirectoryHasDataCore,
  validateStorageDirectoryWritable as validateStorageDirectoryWritableCore
} from '@baishou/core'
import {
  isPathInsideStorageRoot,
  isSameStorageRoot,
  normalizeStorageRoot
} from '@baishou/shared'
import { normalizeExternalStoragePath, stripFileScheme } from './android-external-fs'

function normalizeRoot(path: string): string {
  return normalizeStorageRoot(stripFileScheme(normalizeExternalStoragePath(path)))
}

export { isSameStorageRoot, isPathInsideStorageRoot as isPathInsideRoot }

export async function copyStorageRootContents(
  fileSystem: IFileSystem,
  sourceRoot: string,
  targetRoot: string,
  onProgress?: (itemName: string) => void
): Promise<void> {
  return copyStorageRootContentsCore(
    fileSystem,
    normalizeRoot(sourceRoot),
    normalizeRoot(targetRoot),
    onProgress
  )
}

export async function targetDirectoryHasData(
  fileSystem: IFileSystem,
  targetRoot: string
): Promise<boolean> {
  return targetDirectoryHasDataCore(fileSystem, normalizeRoot(targetRoot))
}

export async function validateStorageDirectoryWritable(
  fileSystem: IFileSystem,
  dirPath: string
): Promise<boolean> {
  return validateStorageDirectoryWritableCore(fileSystem, normalizeRoot(dirPath))
}
