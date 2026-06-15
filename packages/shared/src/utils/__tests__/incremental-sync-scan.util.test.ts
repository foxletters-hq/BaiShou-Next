import { describe, expect, it } from 'vitest'
import {
  shouldIncludeIncrementalSyncFile,
  shouldScanIncrementalSyncDirectory
} from '../incremental-sync-scan.util'

describe('incremental-sync-scan.util', () => {
  it('includes vault root files and settings domain json files', () => {
    expect(shouldIncludeIncrementalSyncFile('a.md', 'Journals/a.md')).toBe(true)
    expect(
      shouldIncludeIncrementalSyncFile('ai_providers.json', '.baishou/settings/ai_providers.json')
    ).toBe(true)
    expect(shouldIncludeIncrementalSyncFile('settings.json', '.baishou/settings.json')).toBe(false)
    expect(shouldIncludeIncrementalSyncFile('manifest.json', '.baishou/manifest.json')).toBe(false)
  })

  it('scans nested vault .baishou/settings', () => {
    expect(shouldScanIncrementalSyncDirectory('.baishou', 'Personal/.baishou')).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('settings', 'Personal/.baishou/settings')).toBe(
      true
    )
    expect(
      shouldIncludeIncrementalSyncFile(
        'ai_providers.json',
        'Personal/.baishou/settings/ai_providers.json'
      )
    ).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('sync-log', 'Personal/.baishou/sync-log')).toBe(
      false
    )
  })

  it('excludes root .baishou sync metadata and other dot directories', () => {
    expect(shouldScanIncrementalSyncDirectory('.baishou', '.baishou')).toBe(false)
    expect(shouldScanIncrementalSyncDirectory('sync-log', '.baishou/sync-log')).toBe(false)
    expect(shouldScanIncrementalSyncDirectory('.versions', '.versions')).toBe(false)
    expect(shouldScanIncrementalSyncDirectory('node_modules', 'node_modules')).toBe(false)
    expect(shouldScanIncrementalSyncDirectory('Sessions', 'Sessions')).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('snapshots', 'snapshots')).toBe(false)
  })
})
