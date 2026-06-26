const SKIP_DIR_NAMES = new Set(['snapshots', 'temp'])
const SKIP_FILE_SUFFIXES = ['-wal', '-shm', '-journal']
export const STORAGE_MIGRATION_STAGING_DIR = '.baishou_migrate_staging'

export function stripStoragePathScheme(path: string): string {
  return path.replace(/^file:\/\//, '')
}

export function normalizeStorageRoot(path: string): string {
  return stripStoragePathScheme(path).replace(/\\/g, '/').replace(/\/+$/, '')
}

/** 用于路径包含关系比较；Windows 盘符路径统一为小写。 */
export function comparableStoragePath(path: string): string {
  const normalized = normalizeStorageRoot(path)
  if (/^[A-Za-z]:/.test(normalized)) return normalized.toLowerCase()
  return normalized
}

export function isSameStorageRoot(a: string, b: string): boolean {
  return comparableStoragePath(a) === comparableStoragePath(b)
}

export function isPathInsideStorageRoot(child: string, root: string): boolean {
  const childPath = comparableStoragePath(child)
  const rootPath = comparableStoragePath(root)
  return childPath === rootPath || childPath.startsWith(`${rootPath}/`)
}

export function shouldSkipStorageMigrationEntry(name: string): boolean {
  if (SKIP_DIR_NAMES.has(name)) return true
  if (name === STORAGE_MIGRATION_STAGING_DIR) return true
  return SKIP_FILE_SUFFIXES.some((suffix) => name.endsWith(suffix))
}
