import { describe, expect, it } from 'vitest'
import {
  buildVaultArchivesSyncPrefix,
  buildVaultJournalsSyncPrefix,
  externalAbsPathToSyncRelPath,
  isVaultExternalPathsConfigRelPath,
  resolveIncrementalSyncRelPath,
  shouldScanIncrementalSyncDirectoryWithExternalMounts,
  type VaultExternalSyncMount
} from '../incremental-sync-external-paths.util'

describe('incremental-sync-external-paths.util', () => {
  const journalsMount: VaultExternalSyncMount = {
    vaultName: 'Personal',
    kind: 'journals',
    absBase: 'D:/life-book/2.日记',
    syncPrefix: buildVaultJournalsSyncPrefix('Personal')
  }

  it('maps external journal file to vault virtual path', () => {
    expect(
      externalAbsPathToSyncRelPath(journalsMount, 'D:/life-book/2.日记/2024/06/2024-06-01.md')
    ).toBe('Personal/Journals/2024/06/2024-06-01.md')
  })

  it('resolves virtual path back to external absolute path', () => {
    expect(
      resolveIncrementalSyncRelPath(
        'C:/Vaults',
        'Personal/Journals/2024/06/2024-06-01.md',
        [journalsMount],
        (...parts) => parts.join('/')
      )
    ).toBe('D:/life-book/2.日记/2024/06/2024-06-01.md')
  })

  it('falls back to sync root for non-mounted paths', () => {
    expect(
      resolveIncrementalSyncRelPath(
        'C:/Vaults',
        'Personal/Sessions/chat.json',
        [journalsMount],
        (...parts) => parts.join('/')
      )
    ).toBe('C:/Vaults/Personal/Sessions/chat.json')
  })

  it('detects external_paths.json sync file', () => {
    expect(isVaultExternalPathsConfigRelPath('Personal/.baishou/external_paths.json')).toBe(true)
  })

  it('skips internal Journals when external mount exists', () => {
    expect(
      shouldScanIncrementalSyncDirectoryWithExternalMounts('Journals', 'Personal/Journals', [
        journalsMount
      ])
    ).toBe(false)
    expect(
      shouldScanIncrementalSyncDirectoryWithExternalMounts('Sessions', 'Personal/Sessions', [
        journalsMount
      ])
    ).toBe(true)
  })

  it('uses Archives virtual prefix for summaries mount', () => {
    const summariesMount: VaultExternalSyncMount = {
      vaultName: 'Personal',
      kind: 'summaries',
      absBase: 'D:/life-book/2.日记/Archives',
      syncPrefix: buildVaultArchivesSyncPrefix('Personal')
    }
    expect(
      externalAbsPathToSyncRelPath(
        summariesMount,
        'D:/life-book/2.日记/Archives/Weekly/2025/2025-01-06.md'
      )
    ).toBe('Personal/Archives/Weekly/2025/2025-01-06.md')
  })
})
