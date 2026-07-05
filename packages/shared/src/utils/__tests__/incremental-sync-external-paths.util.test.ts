import { describe, expect, it } from 'vitest'
import {
  buildVaultArchivesSyncPrefix,
  buildVaultJournalsSyncPrefix,
  externalAbsPathToSyncRelPath,
  isAbsPathUnderExternalSyncMount,
  isUsingExternalVaultDirectory,
  isVaultExternalPathsConfigRelPath,
  normalizeIncrementalSyncAbsPathForCompare,
  resolveIncrementalSyncRelPath,
  shouldExcludeIncrementalSyncRootScanEntry,
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

  it('detects external_paths.json config rel path pattern', () => {
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

  it('detects abs paths under external mount base', () => {
    const inRootMount: VaultExternalSyncMount = {
      vaultName: 'Personal',
      kind: 'journals',
      absBase: 'C:/Vaults/Obsidian/2.日记',
      syncPrefix: buildVaultJournalsSyncPrefix('Personal')
    }
    expect(isAbsPathUnderExternalSyncMount('C:/Vaults/Obsidian/2.日记', [inRootMount])).toBe(true)
    expect(
      isAbsPathUnderExternalSyncMount('C:/Vaults/Obsidian/2.日记/2024/06/01.md', [inRootMount])
    ).toBe(true)
    expect(isAbsPathUnderExternalSyncMount('C:/Vaults/Obsidian/other', [inRootMount])).toBe(false)
    expect(isAbsPathUnderExternalSyncMount('D:/life-book/2.日记', [journalsMount])).toBe(true)
  })

  it('normalizes Android emulated prefix and Windows drive case for compare', () => {
    expect(normalizeIncrementalSyncAbsPathForCompare('/emulated/0/Download/foo')).toBe(
      '/storage/emulated/0/Download/foo'
    )
    expect(normalizeIncrementalSyncAbsPathForCompare('C:/Vaults/Journals')).toBe(
      'c:/vaults/journals'
    )
    expect(
      isAbsPathUnderExternalSyncMount('C:/Vaults/Obsidian/2.日记/01.md', [
        {
          vaultName: 'Personal',
          kind: 'journals',
          absBase: 'c:/Vaults/Obsidian/2.日记',
          syncPrefix: buildVaultJournalsSyncPrefix('Personal')
        }
      ])
    ).toBe(true)
  })

  it('excludes internal Journals rel path when external mount exists', () => {
    expect(
      shouldExcludeIncrementalSyncRootScanEntry(
        'C:/Vaults/Personal/Journals/2024-01-01.md',
        'Personal/Journals/2024-01-01.md',
        [journalsMount]
      )
    ).toBe(true)
  })

  it('detects configured external directory usage', () => {
    expect(
      isUsingExternalVaultDirectory(
        'D:/life-book/2.日记',
        'D:/life-book/2.日记',
        'C:/Vaults/Personal/Journals'
      )
    ).toBe(true)
    expect(
      isUsingExternalVaultDirectory(
        'C:/Vaults/Personal/Journals',
        'C:/Vaults/Personal/Journals',
        'C:/Vaults/Personal/Journals'
      )
    ).toBe(false)
    expect(
      isUsingExternalVaultDirectory(
        null,
        'C:/Vaults/Personal/Journals',
        'C:/Vaults/Personal/Journals'
      )
    ).toBe(false)
  })
})
