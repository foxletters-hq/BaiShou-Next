import {
  callNativeExternal,
  callNativeExternalAsync,
  NATIVE_REBUILD_HINT,
  requireNative
} from './expo-baishou-server.native'
import type {
  ExternalIncrementalSyncScanEntry,
  ExternalPathInfo
} from './expo-baishou-server.types'

/** 外部存储与沙盒本地路径的读写。传输/归档不放这里，避免文件桥和 HTTP/zip 生命周期缠在一起。 */
export function externalGetInfo(path: string): ExternalPathInfo {
  return callNativeExternal('externalGetInfo', (mod) => mod.externalGetInfo(path))
}

export function externalMakeDirectory(path: string, intermediates = true): void {
  callNativeExternal('externalMakeDirectory', (mod) =>
    mod.externalMakeDirectory(path, intermediates)
  )
}

export function externalWriteString(path: string, content: string): void {
  callNativeExternal('externalWriteString', (mod) => mod.externalWriteString(path, content))
}

export function externalAppendString(path: string, content: string): void {
  callNativeExternal('externalAppendString', (mod) => mod.externalAppendString(path, content))
}

export function externalWriteBase64(path: string, base64: string): void {
  callNativeExternal('externalWriteBase64', (mod) => mod.externalWriteBase64(path, base64))
}

export function externalReadString(path: string): string {
  return callNativeExternal('externalReadString', (mod) => mod.externalReadString(path))
}

export function externalReadBase64(path: string): string {
  return callNativeExternal('externalReadBase64', (mod) => mod.externalReadBase64(path))
}

export function externalDelete(path: string, idempotent = true): void {
  callNativeExternal('externalDelete', (mod) => mod.externalDelete(path, idempotent))
}

export function externalReadDirectory(path: string): string[] {
  return callNativeExternal('externalReadDirectory', (mod) => mod.externalReadDirectory(path))
}

export function externalScanIncrementalSyncFiles(path: string): ExternalIncrementalSyncScanEntry[] {
  return callNativeExternal('externalScanIncrementalSyncFiles', (mod) =>
    mod.externalScanIncrementalSyncFiles(path)
  ) as ExternalIncrementalSyncScanEntry[]
}

export function localGetInfo(path: string): ExternalPathInfo {
  return callNativeExternal('localGetInfo', (mod) => mod.localGetInfo(path))
}

export function localReadDirectory(path: string): string[] {
  return callNativeExternal('localReadDirectory', (mod) => mod.localReadDirectory(path))
}

export function localScanIncrementalSyncFiles(path: string): ExternalIncrementalSyncScanEntry[] {
  const mod = requireNative()
  if (typeof mod.localScanIncrementalSyncFiles !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 localScanIncrementalSyncFiles）`)
  }
  return mod.localScanIncrementalSyncFiles(path) as ExternalIncrementalSyncScanEntry[]
}

export function localMd5Hex(path: string): string {
  const mod = requireNative()
  if (typeof mod.localMd5Hex !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 localMd5Hex）`)
  }
  return mod.localMd5Hex(path)
}

export function externalMd5Hex(path: string): string {
  return callNativeExternal('externalMd5Hex', (mod) => mod.externalMd5Hex(path))
}

export function readFileChunkBase64(path: string, position: number, length: number): string {
  const mod = requireNative()
  if (typeof mod.readFileChunkBase64 !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 readFileChunkBase64）`)
  }
  return mod.readFileChunkBase64(path, position, length)
}

export function localAppendString(path: string, content: string): void {
  callNativeExternal('localAppendString', (mod) => mod.localAppendString(path, content))
}

export function externalGetInfoAsync(path: string): Promise<ExternalPathInfo> {
  return callNativeExternalAsync('externalGetInfoAsync', (mod) =>
    typeof mod.externalGetInfoAsync === 'function'
      ? mod.externalGetInfoAsync(path)
      : mod.externalGetInfo(path)
  )
}

export function externalMakeDirectoryAsync(path: string, intermediates = true): Promise<void> {
  return callNativeExternalAsync('externalMakeDirectoryAsync', (mod) =>
    typeof mod.externalMakeDirectoryAsync === 'function'
      ? mod.externalMakeDirectoryAsync(path, intermediates)
      : mod.externalMakeDirectory(path, intermediates)
  )
}

export function externalWriteStringAsync(path: string, content: string): Promise<void> {
  return callNativeExternalAsync('externalWriteStringAsync', (mod) =>
    typeof mod.externalWriteStringAsync === 'function'
      ? mod.externalWriteStringAsync(path, content)
      : mod.externalWriteString(path, content)
  )
}

export function externalAppendStringAsync(path: string, content: string): Promise<void> {
  return callNativeExternalAsync('externalAppendStringAsync', (mod) =>
    typeof mod.externalAppendStringAsync === 'function'
      ? mod.externalAppendStringAsync(path, content)
      : mod.externalAppendString(path, content)
  )
}

export function externalWriteBase64Async(path: string, base64: string): Promise<void> {
  return callNativeExternalAsync('externalWriteBase64Async', (mod) =>
    typeof mod.externalWriteBase64Async === 'function'
      ? mod.externalWriteBase64Async(path, base64)
      : mod.externalWriteBase64(path, base64)
  )
}

export function externalReadStringAsync(path: string): Promise<string> {
  return callNativeExternalAsync('externalReadStringAsync', (mod) =>
    typeof mod.externalReadStringAsync === 'function'
      ? mod.externalReadStringAsync(path)
      : mod.externalReadString(path)
  )
}

export function externalReadBase64Async(path: string): Promise<string> {
  return callNativeExternalAsync('externalReadBase64Async', (mod) =>
    typeof mod.externalReadBase64Async === 'function'
      ? mod.externalReadBase64Async(path)
      : mod.externalReadBase64(path)
  )
}

export function externalDeleteAsync(path: string, idempotent = true): Promise<void> {
  return callNativeExternalAsync('externalDeleteAsync', (mod) =>
    typeof mod.externalDeleteAsync === 'function'
      ? mod.externalDeleteAsync(path, idempotent)
      : mod.externalDelete(path, idempotent)
  )
}

export function externalReadDirectoryAsync(path: string): Promise<string[]> {
  return callNativeExternalAsync('externalReadDirectoryAsync', (mod) =>
    typeof mod.externalReadDirectoryAsync === 'function'
      ? mod.externalReadDirectoryAsync(path)
      : mod.externalReadDirectory(path)
  )
}

export function localGetInfoAsync(path: string): Promise<ExternalPathInfo> {
  return callNativeExternalAsync('localGetInfoAsync', (mod) =>
    typeof mod.localGetInfoAsync === 'function'
      ? mod.localGetInfoAsync(path)
      : mod.localGetInfo(path)
  )
}

export function localReadDirectoryAsync(path: string): Promise<string[]> {
  return callNativeExternalAsync('localReadDirectoryAsync', (mod) =>
    typeof mod.localReadDirectoryAsync === 'function'
      ? mod.localReadDirectoryAsync(path)
      : mod.localReadDirectory(path)
  )
}

export function localAppendStringAsync(path: string, content: string): Promise<void> {
  return callNativeExternalAsync('localAppendStringAsync', (mod) =>
    typeof mod.localAppendStringAsync === 'function'
      ? mod.localAppendStringAsync(path, content)
      : mod.localAppendString(path, content)
  )
}
