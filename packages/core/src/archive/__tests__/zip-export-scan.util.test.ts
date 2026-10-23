import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertArchiveExportOutputPathSafe,
  collectArchiveExternalMountDirs,
  estimateArchiveExportSize,
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

  it('skips root-level sync, git, and runtime sqlite db entries', () => {
    expect(isArchiveRootSkipEntry('.git')).toBe(true)
    expect(isArchiveRootSkipEntry('.baishou-s3.json')).toBe(true)
    expect(isArchiveRootSkipEntry('baishou_agent.db')).toBe(true)
    expect(isArchiveRootSkipEntry('knowledge.db')).toBe(true)
    expect(isArchiveRootSkipEntry('shadow_index_v2.db')).toBe(true)
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
    expect(() => assertArchiveExportOutputPathSafe('D:\\Vaults\\backup.zip', 'D:\\Vaults')).toThrow(
      'ARCHIVE_EXPORT_OUTPUT_INSIDE_STORAGE'
    )
    expect(() =>
      assertArchiveExportOutputPathSafe('D:\\Desktop\\backup.zip', 'D:\\Vaults')
    ).not.toThrow()
  })

  it('collects and estimates external journalsDirectory configured in .baishou/external_paths.json', async () => {
    const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'baishou-zip-scan-root-'))
    const tmpExt = await fsp.mkdtemp(path.join(os.tmpdir(), 'baishou-zip-scan-ext-'))
    try {
      const vaultSysDir = path.join(tmpRoot, 'DefaultVault', '.baishou')
      await fsp.mkdir(vaultSysDir, { recursive: true })
      await fsp.writeFile(
        path.join(vaultSysDir, 'external_paths.json'),
        JSON.stringify({ journalsDirectory: tmpExt }),
        'utf8'
      )
      const extDiaryDir = path.join(tmpExt, '2026', '10')
      await fsp.mkdir(extDiaryDir, { recursive: true })
      await fsp.writeFile(path.join(extDiaryDir, '2026-10-19.md'), '# hello external diary', 'utf8')

      const mounts = await collectArchiveExternalMountDirs(tmpRoot)
      expect(mounts).toHaveLength(1)
      expect(mounts[0]?.vaultName).toBe('DefaultVault')
      expect(mounts[0]?.kind).toBe('journals')
      expect(mounts[0]?.zipRelativePrefix).toBe('DefaultVault/Journals')

      const estimate = await estimateArchiveExportSize(tmpRoot)
      expect(estimate.fileCount).toBe(1)
      expect(estimate.totalBytes).toBeGreaterThan(0)
    } finally {
      await fsp.rm(tmpRoot, { recursive: true, force: true })
      await fsp.rm(tmpExt, { recursive: true, force: true })
    }
  })
})
