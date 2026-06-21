import { describe, expect, it } from 'vitest'
import {
  isIncrementalSyncChatBackgroundPath,
  isSqliteRuntimeSyncPath,
  shouldIncludeIncrementalSyncFile,
  shouldScanIncrementalSyncDirectory
} from '../incremental-sync-scan.util'

describe('incremental-sync-scan.util', () => {
  it('excludes sqlite runtime files from incremental sync', () => {
    expect(isSqliteRuntimeSyncPath('baishou_agent.db')).toBe(true)
    expect(isSqliteRuntimeSyncPath('baishou_agent.db-shm')).toBe(true)
    expect(isSqliteRuntimeSyncPath('baishou_agent.db-wal')).toBe(true)
    expect(isSqliteRuntimeSyncPath('Personal/shadow_index.db')).toBe(true)
    expect(isSqliteRuntimeSyncPath('Journals/a.md')).toBe(false)
    expect(shouldIncludeIncrementalSyncFile('baishou_agent.db-shm', 'baishou_agent.db-shm')).toBe(
      false
    )
    expect(shouldIncludeIncrementalSyncFile('baishou_agent.db', 'baishou_agent.db')).toBe(false)
  })

  it('excludes chat background images from incremental sync', () => {
    expect(isIncrementalSyncChatBackgroundPath('Personal/Attachments/backgrounds')).toBe(true)
    expect(isIncrementalSyncChatBackgroundPath('Personal/Attachments/backgrounds/bg_1.jpg')).toBe(
      true
    )
    expect(isIncrementalSyncChatBackgroundPath('Personal/Attachments/avatars/a.png')).toBe(false)
    expect(
      shouldScanIncrementalSyncDirectory('backgrounds', 'Personal/Attachments/backgrounds')
    ).toBe(false)
    expect(
      shouldIncludeIncrementalSyncFile(
        'bg_1.jpg',
        'Personal/Attachments/backgrounds/bg_1.jpg'
      )
    ).toBe(false)
    expect(shouldIncludeIncrementalSyncFile('photo.jpg', 'Personal/Attachments/diary/photo.jpg')).toBe(
      true
    )
  })

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
    expect(shouldScanIncrementalSyncDirectory('settings', 'Personal/.baishou/settings')).toBe(true)
    expect(
      shouldIncludeIncrementalSyncFile(
        'ai_providers.json',
        'Personal/.baishou/settings/ai_providers.json'
      )
    ).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('sync-log', 'Personal/.baishou/sync-log')).toBe(false)
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
