/** 与 Kotlin `HttpFileTransfer.uploadKey` 对齐；无 RN/Expo 依赖，便于单测 */

function stripFileScheme(uriOrPath: string): string {
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

function normalizeStoragePathLike(uriOrPath: string): string {
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

function isExternalStoragePathLike(uriOrPath: string): boolean {
  const p = normalizeStoragePathLike(uriOrPath)
  if (p.includes('/data/user/') || p.includes('/data/data/')) return false
  return p.startsWith('/storage/') || p.startsWith('/sdcard/') || p.includes('/emulated/0/')
}

/**
 * 与 Kotlin `HttpFileTransfer.uploadKey` / `ExternalStorageFiles.uriToPath` 对齐的 I/O 路径键。
 * 用于原生上传进度匹配、按路径取消等。
 */
export function syncIoPathKey(filePath: string): string {
  const path = isExternalStoragePathLike(filePath)
    ? normalizeStoragePathLike(filePath)
    : stripFileScheme(filePath)
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}
