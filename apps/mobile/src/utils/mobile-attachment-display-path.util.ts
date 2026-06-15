/** 去掉重复的 file:// 前缀（无 react-native 依赖，可供单测） */
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

export function isExternalStoragePathPattern(uriOrPath: string): boolean {
  const p = stripFileScheme(uriOrPath)
  return (
    p.includes('BaiShou_Root') ||
    p.startsWith('/storage/') ||
    p.startsWith('/sdcard/') ||
    p.includes('/emulated/0/')
  )
}

export function toFileUriFromPath(uriOrPath: string): string {
  const path = normalizeExternalStoragePath(uriOrPath)
  if (path.startsWith('/')) return `file://${path}`
  if (uriOrPath.startsWith('file://')) return uriOrPath
  return `file://${uriOrPath}`
}

/** Android 外部 BaiShou_Root 路径无法用 file:// 在 RN Image 中展示 */
export function needsDataUriForImageDisplay(filePath: string): boolean {
  return isExternalStoragePathPattern(normalizeExternalStoragePath(filePath))
}

/** 仅沙盒等非外部路径可回退为 file:// */
export function resolveDisplayFallbackUri(filePath: string): string | null {
  if (!filePath?.trim()) return null
  if (needsDataUriForImageDisplay(filePath)) return null
  return toFileUriFromPath(filePath)
}
