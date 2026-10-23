import { syncIoPathKey } from '../../src/services/mobile-sync-path.util'

import {
  onArchiveImportProgress,
  onStorageRootCopyProgress,
  onSyncHttpTransferProgress
} from './expo-baishou-server.events'
import {
  callNativeExternal,
  getNative,
  NATIVE_REBUILD_HINT,
  requireNative
} from './expo-baishou-server.native'
import type { NativeZipArchiveExportResult, PickDirectoryResult } from './expo-baishou-server.types'

/**
 * HTTP 上传、归档 zip/unzip、局域网传输、选目录与复制。
 * 这些调用带进度订阅和「旧 APK 缺方法」分支，和同步文件读写分开，避免互相改坏。
 */
export function cancelHttpUploadFile(filePath?: string | null): void {
  const mod = getNative()
  if (!mod || typeof mod.cancelHttpUploadFile !== 'function') return
  mod.cancelHttpUploadFile(filePath ?? null)
}

export async function httpUploadFileAsync(
  url: string,
  filePath: string,
  method: string,
  headers: Record<string, string>,
  onProgress?: (writtenBytes: number, totalBytes: number) => void
): Promise<{ status: number }> {
  const mod = requireNative()
  if (typeof mod.httpUploadFileAsync !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 httpUploadFileAsync）`)
  }
  const pathKey = syncIoPathKey(filePath)
  const subscription = onProgress
    ? onSyncHttpTransferProgress((event) => {
        if (syncIoPathKey(event.filePath) === pathKey) {
          onProgress(event.writtenBytes, event.totalBytes)
        }
      })
    : null
  try {
    return await mod.httpUploadFileAsync(url, filePath, method, headers)
  } finally {
    subscription?.remove()
  }
}

export async function nativeUnzipArchive(
  zipPath: string,
  destDir: string,
  onProgress?: (event: { current: number; total: number; detail: string }) => void
): Promise<void> {
  const mod = requireNative()
  if (typeof mod.nativeUnzipArchive !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 nativeUnzipArchive）`)
  }
  const subscription = onProgress
    ? onArchiveImportProgress((event) => {
        if (event.phase !== 'unzip') return
        onProgress({
          current: event.current,
          total: event.total,
          detail: event.detail
        })
      })
    : null
  try {
    await mod.nativeUnzipArchive(zipPath, destDir)
  } finally {
    subscription?.remove()
  }
}

export async function nativeZipArchiveExport(
  storageRoot: string,
  supplementRoot: string | null,
  outputZip: string
): Promise<NativeZipArchiveExportResult> {
  const mod = requireNative()
  if (typeof mod.nativeZipArchiveExport !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 nativeZipArchiveExport）`)
  }
  return mod.nativeZipArchiveExport(storageRoot, supplementRoot, outputZip)
}

export async function nativeCopyArchiveExtractToRoot(
  extractDir: string,
  rootDir: string
): Promise<void> {
  const mod = requireNative()
  if (typeof mod.nativeCopyArchiveExtractToRoot !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 nativeCopyArchiveExtractToRoot）`)
  }
  await mod.nativeCopyArchiveExtractToRoot(extractDir, rootDir)
}

export async function nativeCopyStorageRootAsync(
  sourceRoot: string,
  targetRoot: string,
  onProgress?: (itemName: string) => void
): Promise<void> {
  const mod = requireNative()
  if (typeof mod.nativeCopyStorageRootAsync !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 nativeCopyStorageRootAsync）`)
  }
  const subscription = onProgress
    ? onStorageRootCopyProgress((event) => onProgress(event.itemName))
    : null
  try {
    await mod.nativeCopyStorageRootAsync(sourceRoot, targetRoot)
  } finally {
    subscription?.remove()
  }
}

export async function uploadLanFileAsync(
  url: string,
  filePath: string
): Promise<{ status: number }> {
  const mod = requireNative()
  if (typeof mod.uploadLanFileAsync !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 uploadLanFileAsync）`)
  }
  return mod.uploadLanFileAsync(url, filePath)
}

export function externalMove(fromPath: string, toPath: string): void {
  callNativeExternal('externalMove', (mod) => mod.externalMove(fromPath, toPath))
}

export function externalCopy(fromPath: string, toPath: string): void {
  callNativeExternal('externalCopy', (mod) => mod.externalCopy(fromPath, toPath))
}

export async function externalCopyAsync(fromPath: string, toPath: string): Promise<void> {
  const mod = requireNative()
  if (typeof mod.externalCopyAsync !== 'function') {
    externalCopy(fromPath, toPath)
    return
  }
  await mod.externalCopyAsync(fromPath, toPath)
}

/** 外部存储 ↔ 沙盒等任意路径间流式复制，避免整文件 base64 进 JS */
export async function externalCopyFileAsync(fromPath: string, toPath: string): Promise<void> {
  const mod = requireNative()
  if (typeof mod.externalCopyFileAsync !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 externalCopyFileAsync）`)
  }
  await mod.externalCopyFileAsync(fromPath, toPath)
}

export async function pickDirectoryAsync(): Promise<PickDirectoryResult> {
  const mod = requireNative()
  if (typeof mod.pickDirectoryAsync !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 pickDirectoryAsync）`)
  }
  return mod.pickDirectoryAsync()
}
