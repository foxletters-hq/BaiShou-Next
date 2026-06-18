import { describe, expect, it } from 'vitest'

import {
  assertSafeSnapshotFilename,
  collectSnapshotPreserveKeys,
  formatArchiveExportErrorMessage,
  hasArchiveWorkspaceEntries,
  isValidArchiveManifestContent,
  parseSnapshotCreatedAtFromFilename,
  resolveSnapshotCreatedAt,
  resolveArchiveImportStageMessage,
  shouldRefreshVaultAfterArchiveImport,
  validateArchiveExtractPayload
} from '../archive-guards.util'
import { normalizeMtimeToMs } from '../../utils/fs-mtime.util'

describe('assertSafeSnapshotFilename', () => {
  it('accepts valid snapshot names', () => {
    expect(() => assertSafeSnapshotFilename('snapshot_20260101_120000123.zip')).not.toThrow()
  })

  it('rejects path traversal', () => {
    expect(() => assertSafeSnapshotFilename('../snapshot_x.zip')).toThrow('无效的快照文件名')
    expect(() => assertSafeSnapshotFilename('snapshot_%2e%2e.zip')).toThrow('无效的快照文件名')
  })
})

describe('isValidArchiveManifestContent', () => {
  it('accepts formatVersion >= 1', () => {
    expect(
      isValidArchiveManifestContent(JSON.stringify({ formatVersion: 1, platform: 'mobile' }))
    ).toBe(true)
  })

  it('rejects invalid manifest', () => {
    expect(isValidArchiveManifestContent('not-json')).toBe(false)
    expect(isValidArchiveManifestContent(JSON.stringify({ platform: 'mobile' }))).toBe(false)
    expect(isValidArchiveManifestContent(JSON.stringify({ formatVersion: 0 }))).toBe(false)
  })
})

describe('validateArchiveExtractPayload', () => {
  it('rejects empty archives', () => {
    expect(() =>
      validateArchiveExtractPayload({
        isFlutterLegacyZip: false,
        isEmpty: true,
        hasValidManifest: false,
        hasDatabase: false,
        hasVaultRegistry: false,
        hasVaultDirectory: false
      })
    ).toThrow('备份包为空')
  })

  it('rejects archives without valid manifest', () => {
    expect(() =>
      validateArchiveExtractPayload({
        isFlutterLegacyZip: false,
        isEmpty: false,
        hasValidManifest: false,
        hasDatabase: true,
        hasVaultRegistry: false,
        hasVaultDirectory: false
      })
    ).toThrow('不是有效的 BaiShou 备份包')
  })

  it('rejects manifest-only archives', () => {
    expect(() =>
      validateArchiveExtractPayload({
        isFlutterLegacyZip: false,
        isEmpty: false,
        hasValidManifest: true,
        hasDatabase: false,
        hasVaultRegistry: false,
        hasVaultDirectory: false
      })
    ).toThrow('缺少数据库或工作区数据')
  })

  it('rejects manifest plus random file without workspace data', () => {
    expect(() =>
      validateArchiveExtractPayload({
        isFlutterLegacyZip: false,
        isEmpty: false,
        hasValidManifest: true,
        hasDatabase: false,
        hasVaultRegistry: false,
        hasVaultDirectory: false
      })
    ).toThrow('缺少数据库或工作区数据')
  })

  it('accepts manifest with database', () => {
    expect(() =>
      validateArchiveExtractPayload({
        isFlutterLegacyZip: false,
        isEmpty: false,
        hasValidManifest: true,
        hasDatabase: true,
        hasVaultRegistry: false,
        hasVaultDirectory: false
      })
    ).not.toThrow()
  })

  it('accepts manifest with vault directory', () => {
    expect(() =>
      validateArchiveExtractPayload({
        isFlutterLegacyZip: false,
        isEmpty: false,
        hasValidManifest: true,
        hasDatabase: false,
        hasVaultRegistry: false,
        hasVaultDirectory: true
      })
    ).not.toThrow()
  })

  it('accepts manifest with vault_registry.json', () => {
    expect(() =>
      validateArchiveExtractPayload({
        isFlutterLegacyZip: false,
        isEmpty: false,
        hasValidManifest: true,
        hasDatabase: false,
        hasVaultRegistry: true,
        hasVaultDirectory: false
      })
    ).not.toThrow()
  })
})

describe('collectSnapshotPreserveKeys', () => {
  it('preserves by absolute path and snapshot filename', () => {
    const keys = collectSnapshotPreserveKeys([
      'file:///data/user/0/app/snapshots/snapshot_20260101_120000123.zip',
      'content://picker/staged.zip'
    ])
    expect(keys.absolutes.has('/data/user/0/app/snapshots/snapshot_20260101_120000123.zip')).toBe(
      true
    )
    expect(keys.filenames.has('snapshot_20260101_120000123.zip')).toBe(true)
    expect(keys.filenames.has('staged.zip')).toBe(false)
  })
})

describe('parseSnapshotCreatedAtFromFilename', () => {
  it('parses mobile snapshot names with milliseconds', () => {
    const ts = parseSnapshotCreatedAtFromFilename('snapshot_20260617_143052123.zip')
    expect(ts).not.toBeNull()
    const date = new Date(ts!)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(5)
    expect(date.getDate()).toBe(17)
    expect(date.getHours()).toBe(14)
    expect(date.getMinutes()).toBe(30)
    expect(date.getSeconds()).toBe(52)
    expect(date.getMilliseconds()).toBe(123)
  })

  it('parses flutter snapshot names without milliseconds', () => {
    const ts = parseSnapshotCreatedAtFromFilename('snapshot_20260101_120000.zip')
    expect(ts).not.toBeNull()
    const date = new Date(ts!)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(0)
    expect(date.getDate()).toBe(1)
    expect(date.getHours()).toBe(12)
    expect(date.getMinutes()).toBe(0)
    expect(date.getSeconds()).toBe(0)
  })
})

describe('resolveSnapshotCreatedAt', () => {
  it('prefers filename over mtime', () => {
    const createdAt = resolveSnapshotCreatedAt('snapshot_20260101_120000.zip', Date.UTC(1999, 0, 1))
    expect(new Date(createdAt).getFullYear()).toBe(2026)
  })
})

describe('normalizeMtimeToMs', () => {
  it('treats values below 1e12 as seconds', () => {
    expect(normalizeMtimeToMs(1_700_000_000)).toBe(1_700_000_000_000)
  })

  it('keeps millisecond timestamps unchanged', () => {
    expect(normalizeMtimeToMs(1_700_000_000_123)).toBe(1_700_000_000_123)
  })
})

describe('shouldRefreshVaultAfterArchiveImport', () => {
  it('refreshes after successful restore', () => {
    expect(
      shouldRefreshVaultAfterArchiveImport({
        fileCount: -1,
        profileRestored: true
      })
    ).toBe(true)
  })

  it('skips refresh when import failed', () => {
    expect(
      shouldRefreshVaultAfterArchiveImport({
        fileCount: 0,
        profileRestored: false
      })
    ).toBe(false)
  })
})

describe('hasArchiveWorkspaceEntries', () => {
  it('ignores metadata-only top-level entries', () => {
    expect(hasArchiveWorkspaceEntries(['manifest.json', 'config', 'database'])).toBe(false)
    expect(hasArchiveWorkspaceEntries(['manifest.json', 'Personal'])).toBe(true)
  })
})

describe('formatArchiveExportErrorMessage', () => {
  it('returns error message text', () => {
    expect(formatArchiveExportErrorMessage(new Error('打包数据库失败：disk full'))).toBe(
      '打包数据库失败：disk full'
    )
  })
})

describe('resolveArchiveImportStageMessage', () => {
  it('returns human-readable stage labels', () => {
    expect(resolveArchiveImportStageMessage({ stage: 'unpacking' })).toContain('解压')
    expect(resolveArchiveImportStageMessage({ stage: 'migrating_legacy' })).toContain('迁移')
  })
})
