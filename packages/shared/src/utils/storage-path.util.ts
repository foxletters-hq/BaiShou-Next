const SKIP_DIR_NAMES = new Set(['snapshots', 'temp'])
const SKIP_FILE_SUFFIXES = ['-wal', '-shm', '-journal']
export const STORAGE_MIGRATION_STAGING_DIR = '.baishou_migrate_staging'

export function stripStoragePathScheme(path: string): string {
  return path.replace(/^file:\/\//, '')
}

export function normalizeStorageRoot(path: string): string {
  return stripStoragePathScheme(path).replace(/\\/g, '/').replace(/\/+$/, '')
}

export function shouldSkipStorageMigrationEntry(name: string): boolean {
  if (SKIP_DIR_NAMES.has(name)) return true
  if (name === STORAGE_MIGRATION_STAGING_DIR) return true
  return SKIP_FILE_SUFFIXES.some((suffix) => name.endsWith(suffix))
}

export function isSameStorageRoot(a: string, b: string): boolean {
  return normalizeStorageRoot(a) === normalizeStorageRoot(b)
}

export function isPathInsideStorageRoot(child: string, root: string): boolean {
  const childPath = normalizeStorageRoot(child)
  const rootPath = normalizeStorageRoot(root)
  return childPath === rootPath || childPath.startsWith(`${rootPath}/`)
}
