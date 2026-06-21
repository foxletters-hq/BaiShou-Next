import { Platform } from 'react-native'
import {
  externalCopy,
  externalCopyAsync,
  externalCopyFileAsync,
  externalDelete,
  externalGetInfo,
  externalMakeDirectory,
  externalMove,
  externalReadBase64,
  externalReadDirectory,
  externalReadString,
  externalWriteBase64,
  externalWriteString,
  externalAppendString,
  localAppendString,
  isExternalStorageNativeAvailable,
  isLocalFsNativeAvailable,
  localGetInfo,
  localReadDirectory,
  localMd5Hex,
  externalMd5Hex
} from 'expo-baishou-server'

export const EXTERNAL_STORAGE_REBUILD_HINT =
  '无法写入外部 BaiShou_Root：当前 APK 未包含原生存储模块或版本过旧。请执行 pnpm dev:mobile:clear 重新编译安装（勿用 Expo Go），并在系统设置中开启「管理所有文件」。'

/** 将绝对路径各段编码为合法 file:// URI（避免 % # 等触发 Java URI 解析错误） */
function encodeAbsolutePathForFileUri(absPath: string): string {
  return absPath
    .split('/')
    .map((segment) => {
      if (segment === '') return ''
      let decoded = segment
      try {
        decoded = decodeURIComponent(segment)
      } catch {
        /* 已是原始文件名 */
      }
      return encodeURIComponent(decoded)
    })
    .join('/')
}

/** 去掉重复的 file:// 前缀，并解码 URI 转义段 */
export function stripFileScheme(uriOrPath: string): string {
  let s = uriOrPath.trim()
  while (s.startsWith('file://')) {
    s = s.slice('file://'.length)
  }
  return s
    .split('/')
    .map((segment) => {
      if (segment === '') return ''
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .join('/')
}

/** 去掉 file:// 与尾部 /，供磁盘 I/O 使用（勿把带 file:// 的路径直接拼子路径） */
export function normalizeStoragePath(uriOrPath: string): string {
  let p = stripFileScheme(uriOrPath).replace(/\/+$/, '')
  if (p.startsWith('/storage/storage/emulated/0')) {
    p = p.replace('/storage/storage/emulated/0', '/storage/emulated/0')
  } else if (p.startsWith('storage/storage/emulated/0')) {
    p = p.replace('storage/storage/emulated/0', '/storage/emulated/0')
  } else if (p.startsWith('/emulated/0')) {
    p = `/storage${p}`
  } else if (p.startsWith('emulated/0')) {
    p = `/storage/${p}`
  } else if (p.startsWith('storage/emulated/0')) {
    p = `/${p}`
  }
  return p
}

/** 修正 Android Uri 解析导致的 /emulated/0 → /storage/emulated/0 */
export function normalizeExternalStoragePath(uriOrPath: string): string {
  return normalizeStoragePath(uriOrPath)
}

export function toFileUri(uriOrPath: string): string {
  if (uriOrPath.startsWith('content://') || uriOrPath.startsWith('data:')) return uriOrPath
  const path = normalizeExternalStoragePath(uriOrPath)
  if (path.startsWith('/')) return `file://${encodeAbsolutePathForFileUri(path)}`
  return `file://${encodeAbsolutePathForFileUri(`/${path}`)}`
}

function isAppSandboxPath(uriOrPath: string): boolean {
  const p = normalizeExternalStoragePath(uriOrPath)
  return p.includes('/data/user/') || p.includes('/data/data/')
}

/** Android 应用沙盒路径（cache / files），需走 java.io.File 以正确处理 Unicode 文件名 */
export function isAndroidAppSandboxPath(uriOrPath: string): boolean {
  if (Platform.OS !== 'android') return false
  return isAppSandboxPath(uriOrPath)
}

/**
 * 是否必须使用原生 File API（勿用 expo-file-system）
 * 旧版 Flutter 默认路径 app_flutter/BaiShou_Root 仍在应用沙盒内，须走 Expo FS。
 */
export function isExternalStoragePath(uriOrPath: string): boolean {
  if (Platform.OS !== 'android') return false
  const p = normalizeExternalStoragePath(uriOrPath)
  if (isAppSandboxPath(p)) return false
  return p.startsWith('/storage/') || p.startsWith('/sdcard/') || p.includes('/emulated/0/')
}

/** 访问该路径是否需要 MANAGE_EXTERNAL_STORAGE / WRITE_EXTERNAL_STORAGE */
export function requiresAllFilesAccessForPath(uriOrPath: string): boolean {
  return isExternalStoragePath(uriOrPath)
}

function ensureNativeModule(): void {
  if (!isExternalStorageNativeAvailable()) {
    throw new Error(EXTERNAL_STORAGE_REBUILD_HINT)
  }
}

export type ExternalPathInfo = {
  exists: boolean
  isDirectory: boolean
  modificationTime: number
  size: number
}

export function externalGetInfoSafe(uriOrPath: string): ExternalPathInfo {
  ensureNativeModule()
  return externalGetInfo(toFileUri(uriOrPath))
}

export function externalMkdirSafe(uriOrPath: string, intermediates = true): void {
  ensureNativeModule()
  externalMakeDirectory(toFileUri(uriOrPath), intermediates)
}

export function externalWriteTextSafe(uriOrPath: string, content: string): void {
  ensureNativeModule()
  externalWriteString(toFileUri(uriOrPath), content)
}

export function externalAppendTextSafe(uriOrPath: string, content: string): void {
  ensureNativeModule()
  externalAppendString(toFileUri(uriOrPath), content)
}

export function localAppendTextSafe(uriOrPath: string, content: string): void {
  ensureNativeModule()
  localAppendString(normalizeStoragePath(uriOrPath), content)
}

export function externalWriteB64Safe(uriOrPath: string, base64: string): void {
  ensureNativeModule()
  externalWriteBase64(toFileUri(uriOrPath), base64)
}

export function externalReadTextSafe(uriOrPath: string): string {
  ensureNativeModule()
  return externalReadString(toFileUri(uriOrPath))
}

export function externalReadB64Safe(uriOrPath: string): string {
  ensureNativeModule()
  return externalReadBase64(toFileUri(uriOrPath))
}

export function externalDeleteSafe(uriOrPath: string, idempotent = true): void {
  ensureNativeModule()
  externalDelete(toFileUri(uriOrPath), idempotent)
}

export function externalListDirSafe(uriOrPath: string): string[] {
  ensureNativeModule()
  return externalReadDirectory(toFileUri(uriOrPath))
}

export function localGetInfoSafe(uriOrPath: string): ExternalPathInfo {
  ensureNativeModule()
  return localGetInfo(normalizeStoragePath(uriOrPath))
}

export function localListDirSafe(uriOrPath: string): string[] {
  ensureNativeModule()
  return localReadDirectory(normalizeStoragePath(uriOrPath))
}

export function localMd5HexSafe(uriOrPath: string): string | null {
  if (!isLocalFsNativeAvailable()) return null
  try {
    return localMd5Hex(normalizeStoragePath(uriOrPath))
  } catch {
    return null
  }
}

export function externalMd5HexSafe(uriOrPath: string): string | null {
  if (!isExternalStorageNativeAvailable()) return null
  try {
    return externalMd5Hex(toFileUri(uriOrPath))
  } catch {
    return null
  }
}

export function externalMoveSafe(from: string, to: string): void {
  ensureNativeModule()
  externalMove(toFileUri(from), toFileUri(to))
}

export function externalCopySafe(from: string, to: string): void {
  ensureNativeModule()
  externalCopy(toFileUri(from), toFileUri(to))
}

export async function externalCopyAsyncSafe(from: string, to: string): Promise<void> {
  ensureNativeModule()
  await externalCopyAsync(toFileUri(from), toFileUri(to))
}

/** 外部 ↔ 沙盒等跨边界复制，原生流式 I/O */
export async function externalCopyFileAsyncSafe(from: string, to: string): Promise<void> {
  ensureNativeModule()
  await externalCopyFileAsync(toFileUri(from), toFileUri(to))
}
