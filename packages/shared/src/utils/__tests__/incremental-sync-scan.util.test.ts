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
    expect(shouldIncludeIncrementalSyncFile('manifest.json', '.baishou/manifest.json')).toBe(
      false
    )
  })

  it('scans .baishou/settings but not other .baishou subdirectories', () => {
    expect(shouldScanIncrementalSyncDirectory('.baishou', '.baishou')).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('settings', '.baishou/settings')).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('sync-log', '.baishou/sync-log')).toBe(false)
    expect(shouldScanIncrementalSyncDirectory('.versions', '.versions')).toBe(false)
    expect(shouldScanIncrementalSyncDirectory('node_modules', 'node_modules')).toBe(false)
    expect(shouldScanIncrementalSyncDirectory('Sessions', 'Sessions')).toBe(true)
  })
})
