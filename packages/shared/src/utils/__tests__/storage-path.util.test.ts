import { describe, expect, it } from 'vitest'
import {
  isPathInsideStorageRoot,
  isSameStorageRoot,
  normalizeStorageRoot,
  shouldSkipStorageMigrationEntry,
  STORAGE_MIGRATION_STAGING_DIR
} from '../storage-path.util'

describe('storage-path.util', () => {
  it('normalizes file scheme and trailing slashes', () => {
    expect(normalizeStorageRoot('file:///storage/emulated/0/BaiShou_Root/')).toBe(
      '/storage/emulated/0/BaiShou_Root'
    )
  })

  it('detects same storage root', () => {
    expect(isSameStorageRoot('/a/b/', 'file:///a/b')).toBe(true)
    expect(isSameStorageRoot('/a/b', '/a/c')).toBe(false)
  })

  it('detects child inside root', () => {
    expect(isPathInsideStorageRoot('/root/vault', '/root')).toBe(true)
    expect(isPathInsideStorageRoot('/root', '/root')).toBe(true)
    expect(isPathInsideStorageRoot('/other', '/root')).toBe(false)
  })

  it('skips sqlite sidecar and staging dir', () => {
    expect(shouldSkipStorageMigrationEntry('baishou.db-wal')).toBe(true)
    expect(shouldSkipStorageMigrationEntry('temp')).toBe(true)
    expect(shouldSkipStorageMigrationEntry(STORAGE_MIGRATION_STAGING_DIR)).toBe(true)
    expect(shouldSkipStorageMigrationEntry('Personal')).toBe(false)
  })
})
