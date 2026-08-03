/**
 * 同步相对路径安全校验：拒绝绝对路径与 `..` 穿越。
 * 供 renameFile / manifest 键等入口共用。
 */

export class UnsafeSyncRelPathError extends Error {
  readonly path: string

  constructor(path: string, reason?: string) {
    super(reason ?? `Unsafe sync relative path: ${path}`)
    this.name = 'UnsafeSyncRelPathError'
    this.path = path
  }
}

/**
 * 规范化并断言同步相对路径安全。
 * - 统一为 `/` 分隔、去掉首尾空白与前导 `/`
 * - 拒绝空路径、`..` / `.` 段、盘符绝对路径、空段（`a//b`）
 */
export function assertSafeSyncRelPath(relPath: string): string {
  if (typeof relPath !== 'string') {
    throw new UnsafeSyncRelPathError(String(relPath), 'Sync relative path must be a string')
  }
  const trimmed = relPath.replace(/\\/g, '/').trim()
  if (!trimmed) {
    throw new UnsafeSyncRelPathError(relPath, 'Sync relative path must not be empty')
  }
  if (/^[A-Za-z]:/.test(trimmed)) {
    throw new UnsafeSyncRelPathError(relPath, 'Sync relative path must not be absolute')
  }
  const normalized = trimmed.replace(/^\/+|\/+$/g, '')
  if (!normalized) {
    throw new UnsafeSyncRelPathError(relPath, 'Sync relative path must not be empty')
  }
  const segments = normalized.split('/')
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..') {
      throw new UnsafeSyncRelPathError(
        relPath,
        `Sync relative path must not contain '.' or '..' segments: ${relPath}`
      )
    }
  }
  return normalized
}
