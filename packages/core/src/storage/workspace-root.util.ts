import { normalizeStorageRoot } from '@baishou/shared'
import * as path from '../fs/path.util'

const WINDOWS_DRIVE_ROOT_RE = /^[A-Za-z]:[\\/]*$/

const WINDOWS_FORBIDDEN_SEGMENTS = new Set([
  'windows',
  'program files',
  'program files (x86)',
  'programdata',
  '$recycle.bin',
  'system volume information'
])

/** 是否为文件系统根路径（如 `C:\`、`D:`、`/`）。 */
export function isFilesystemRootPath(filePath: string): boolean {
  const trimmed = filePath.trim()
  if (!trimmed) return false
  if (WINDOWS_DRIVE_ROOT_RE.test(trimmed)) return true

  const normalized = path.resolve(trimmed).replace(/\\/g, '/')
  if (normalized === '/') return true

  const driveOnly = /^[A-Za-z]:\/?$/.exec(normalized)
  return driveOnly != null
}

/** 是否可作为新版工作区根目录持久化（拒绝盘符根与常见系统目录）。 */
export function isValidWorkspaceRoot(filePath: string): boolean {
  const trimmed = filePath.trim()
  if (!trimmed) return false
  if (isFilesystemRootPath(trimmed)) return false

  const normalized = normalizeStorageRoot(trimmed)
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) return false

  const lowerSegments = segments.map((segment) => segment.toLowerCase())

  if (lowerSegments.length === 1 && WINDOWS_FORBIDDEN_SEGMENTS.has(lowerSegments[0]!)) {
    return false
  }

  if (
    lowerSegments.length >= 2 &&
    /^[a-z]:$/.test(lowerSegments[0]!) &&
    WINDOWS_FORBIDDEN_SEGMENTS.has(lowerSegments[1]!)
  ) {
    return false
  }

  if (
    normalized.startsWith('/') &&
    lowerSegments.length === 1 &&
    ['etc', 'usr', 'bin', 'sbin', 'var', 'tmp', 'root', 'sys', 'proc', 'dev'].includes(
      lowerSegments[0]!
    )
  ) {
    return false
  }

  return true
}

/**
 * 旧版 Flutter 数据若在盘符根目录，新版应写入其子目录而非根路径本身。
 */
export function resolveLegacyMigrationTargetRoot(sourceRoot: string): string {
  if (!isFilesystemRootPath(sourceRoot)) return sourceRoot

  const trimmed = sourceRoot.trim()
  if (WINDOWS_DRIVE_ROOT_RE.test(trimmed)) {
    return `${trimmed.slice(0, 2)}\\BaiShou_Root`
  }

  return path.join(sourceRoot, 'BaiShou_Root')
}

/** 将设置/引导中读到的存储根规整为可安全持久化的路径。 */
export function sanitizePersistedWorkspaceRoot(filePath: string): string {
  const trimmed = filePath.trim()
  if (!trimmed) return trimmed
  if (isValidWorkspaceRoot(trimmed)) return trimmed
  if (isFilesystemRootPath(trimmed)) return resolveLegacyMigrationTargetRoot(trimmed)
  return trimmed
}

export function displayLegacyMigrationPath(pathValue: string): string {
  return normalizeStorageRoot(pathValue)
}
