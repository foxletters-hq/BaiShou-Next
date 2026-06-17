import type { IFileSystem } from '@baishou/core-mobile'
import {
  copyStorageRootContents as copyStorageRootContentsCore,
  targetDirectoryHasData as targetDirectoryHasDataCore,
  validateStorageDirectoryWritable as validateStorageDirectoryWritableCore
} from '@baishou/core-mobile'
import { isPathInsideStorageRoot, isSameStorageRoot, normalizeStorageRoot } from '@baishou/shared'
import {
  isNativeStorageRootMigrationAvailable,
  nativeCopyStorageRootAsync
} from 'expo-baishou-server'
import { Platform } from 'react-native'
import { normalizeExternalStoragePath, stripFileScheme, toFileUri } from './android-external-fs'

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
  const source = normalizeRoot(sourceRoot)
  const target = normalizeRoot(targetRoot)

  if (Platform.OS === 'android' && isNativeStorageRootMigrationAvailable()) {
    await nativeCopyStorageRootAsync(toFileUri(source), toFileUri(target), onProgress)
    return
  }

  return copyStorageRootContentsCore(fileSystem, source, target, onProgress)
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
