import { describe, expect, it } from 'vitest'
import {
  assertArchiveExportOutputPathSafe,
  isArchiveRecursiveSkipDir,
  isArchiveRootSkipEntry,
  isExcludedArchiveOutputPath,
  isInProgressBaishouBackupZip,
  shouldSkipArchiveFile,
  type ArchiveExportScanContext
} from '../zip-export-scan.util'

describe('zip-export-scan.util', () => {
  it('skips git and app metadata directories at any depth', () => {
    expect(isArchiveRecursiveSkipDir('.git')).toBe(true)
    expect(isArchiveRecursiveSkipDir('.git.vault-legacy')).toBe(true)
    expect(isArchiveRecursiveSkipDir('.baishou')).toBe(true)
  })

  it('skips root-level sync and git entries', () => {
    expect(isArchiveRootSkipEntry('.git')).toBe(true)
    expect(isArchiveRootSkipEntry('.baishou-s3.json')).toBe(true)
    expect(isArchiveRootSkipEntry('Personal')).toBe(false)
  })

  it('skips write probe, sqlite sidecar, and in-progress backup zip names', () => {
    const ctx: ArchiveExportScanContext = {
      rootRealPath: 'D:/Vaults',
      excludedOutputComparablePath: 'd:/vaults/backup.zip',
      skipInProgressBackupZips: true
    }
    expect(shouldSkipArchiveFile('.write_test_123_abcd', ctx)).toBe(true)
    expect(shouldSkipArchiveFile('baishou_agent.db-wal', ctx)).toBe(true)
    expect(shouldSkipArchiveFile('BaiShou_Vault_Backup_20260101_1200.zip', ctx)).toBe(true)
    expect(shouldSkipArchiveFile('diary.md', ctx)).toBe(false)
    expect(isInProgressBaishouBackupZip('BaiShou_Full_Archive_123.zip')).toBe(true)
  })

  it('excludes output zip path case-insensitively on Windows', () => {
    const ctx: ArchiveExportScanContext = {
      rootRealPath: 'D:/Vaults',
      excludedOutputComparablePath: 'd:/vaults/backup.zip',
      skipInProgressBackupZips: true
    }
    expect(isExcludedArchiveOutputPath('D:\\Vaults\\backup.zip', ctx)).toBe(true)
    expect(isExcludedArchiveOutputPath('D:\\Vaults\\other.zip', ctx)).toBe(false)
  })

  it('rejects export output inside storage root', () => {
    expect(() =>
      assertArchiveExportOutputPathSafe('D:\\Vaults\\backup.zip', 'D:\\Vaults')
    ).toThrow('ARCHIVE_EXPORT_OUTPUT_INSIDE_STORAGE')
    expect(() =>
      assertArchiveExportOutputPathSafe('D:\\Desktop\\backup.zip', 'D:\\Vaults')
    ).not.toThrow()
  })
})
