import { Platform } from 'react-native'
import {
  externalCopy,
  externalCopyAsync,
  externalDelete,
  externalGetInfo,
  externalMakeDirectory,
  externalMove,
  externalReadBase64,
  externalReadDirectory,
  externalReadString,
  externalWriteBase64,
  externalWriteString,
  isExternalStorageNativeAvailable
} from 'expo-baishou-server'

export const EXTERNAL_STORAGE_REBUILD_HINT =
  '无法写入外部 BaiShou_Root：当前 APK 未包含原生存储模块或版本过旧。请执行 pnpm dev:mobile:clear 重新编译安装（勿用 Expo Go），并在系统设置中开启「管理所有文件」。'

/** 去掉重复的 file:// 前缀 */
export function stripFileScheme(uriOrPath: string): string {
  let s = uriOrPath.trim()
  while (s.startsWith('file://')) {
    s = s.slice('file://'.length)
  }
  return s
}

/** 修正 Android Uri 解析导致的 /emulated/0 → /storage/emulated/0 */
export function normalizeExternalStoragePath(uriOrPath: string): string {
  let p = stripFileScheme(uriOrPath)
  if (p.startsWith('/emulated/0')) {
    p = `/storage${p}`
  } else if (p.startsWith('emulated/0')) {
    p = `/storage/${p}`
  }
  return p
}

export function toFileUri(uriOrPath: string): string {
  const path = normalizeExternalStoragePath(uriOrPath)
  if (path.startsWith('/')) return `file://${path}`
  if (uriOrPath.startsWith('file://')) return uriOrPath
  return `file://${uriOrPath}`
}

/**
 * 是否必须使用原生 File API（勿用 expo-file-system）
 * 用路径内容判断，避免 Platform / file:// 边界情况漏判
 */
export function isExternalStoragePath(uriOrPath: string): boolean {
  if (Platform.OS !== 'android') return false
  const p = stripFileScheme(uriOrPath)
  return (
    p.includes('BaiShou_Root') ||
    p.startsWith('/storage/') ||
    p.startsWith('/sdcard/') ||
    p.includes('/emulated/0/')
  )
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
