import { describe, expect, it } from 'vitest'
import {
  buildIncrementalSyncBoundaryHints,
  buildIncrementalSyncBoundaryIssues,
  buildIncrementalSyncPlanPreview,
  formatIncrementalSyncPlanBytes,
  resolveIncrementalSyncVaultScope
} from '../incremental-sync-plan.util'
import type { MergeDecision } from '../three-way-merge'

function decision(
  filePath: string,
  type: MergeDecision['type'],
  options?: { direction?: MergeDecision['direction']; size?: number }
): MergeDecision {
  return {
    filePath,
    type,
    direction: options?.direction,
    hash: 'h',
    size: options?.size ?? 1,
    localEntry: null,
    remoteEntry: null,
    ancestorEntry: null
  }
}

describe('incremental-sync-plan.util', () => {
  it('resolveIncrementalSyncVaultScope maps nested paths to vault name', () => {
    expect(resolveIncrementalSyncVaultScope('Personal/Journals/2024/01/a.md')).toBe('Personal')
    expect(resolveIncrementalSyncVaultScope('vault_registry.json')).toBe('__root__')
  })

  it('buildIncrementalSyncBoundaryIssues detects registry/disk mismatch', () => {
    const issues = buildIncrementalSyncBoundaryIssues({
      registeredVaults: ['Personal', 'Work'],
      diskVaultNames: ['Personal', 'Archive'],
      planItems: [
        {
          filePath: 'Archive/Journals/a.md',
          action: 'upload',
          vaultScope: 'Archive',
          sizeBytes: 1
        }
      ],
      manifestVaultScopes: new Set(['Personal', 'Archive', 'Work'])
    })
    expect(issues.diskVaultsNotInRegistry).toEqual(['Archive'])
    expect(issues.registryVaultsMissingOnDisk).toEqual(['Work'])
    expect(issues.unknownVaultPaths).toEqual(['Archive'])
  })

  it('treats case-only disk folder as present for registry vault', () => {
    const issues = buildIncrementalSyncBoundaryIssues({
      registeredVaults: ['Work'],
      diskVaultNames: ['work'],
      planItems: [],
      manifestVaultScopes: new Set(['Work'])
    })
    expect(issues.registryVaultsMissingOnDisk).toEqual([])
  })

  it('ignores registry-only vaults without manifest data or pending changes', () => {
    const issues = buildIncrementalSyncBoundaryIssues({
      registeredVaults: ['Personal', 'C__Users_Desktop_OldVault'],
      diskVaultNames: ['Personal'],
      planItems: [
        {
          filePath: 'Personal/a.md',
          action: 'upload',
          vaultScope: 'Personal',
          sizeBytes: 1
        }
      ],
      manifestVaultScopes: new Set(['Personal'])
    })
    expect(issues.registryVaultsMissingOnDisk).toEqual([])
  })

  it('buildIncrementalSyncBoundaryHints avoids duplicate unknown/disk warnings', () => {
    const issues = buildIncrementalSyncBoundaryIssues({
      registeredVaults: ['Personal'],
      diskVaultNames: ['Personal', 'Archive', 'haha'],
      planItems: [
        { filePath: 'Archive/a.md', action: 'upload', vaultScope: 'Archive', sizeBytes: 1 },
        { filePath: 'haha/b.md', action: 'download', vaultScope: 'haha', sizeBytes: 1 }
      ]
    })
    const hints = buildIncrementalSyncBoundaryHints(issues)
    expect(hints).toHaveLength(1)
    expect(hints[0]?.messageKey).toBe('data_sync.plan_warning_unknown_vault_paths')
    expect(hints[0]?.names).toEqual(['Archive', 'haha'])
  })

  it('ignores disk folders without pending plan changes', () => {
    const issues = buildIncrementalSyncBoundaryIssues({
      registeredVaults: ['Personal'],
      diskVaultNames: ['Personal', 'default', 'k'],
      planItems: [
        {
          filePath: 'Personal/Journals/a.md',
          action: 'upload',
          vaultScope: 'Personal',
          sizeBytes: 1
        }
      ]
    })
    expect(issues.diskVaultsNotInRegistry).toEqual([])
    expect(issues.unknownVaultPaths).toEqual([])
  })

  it('buildIncrementalSyncPlanPreview groups changes by vault', () => {
    const preview = buildIncrementalSyncPlanPreview({
      decisions: [
        decision('Personal/Journals/2024-01-01.md', 'upload'),
        decision('Work/Journals/2024-01-02.md', 'download'),
        decision('Personal/old.md', 'skip')
      ],
      registeredVaults: ['Personal', 'Work'],
      diskVaultNames: ['Personal', 'Work'],
      activeVaultName: 'Personal'
    })

    expect(preview.changeCount).toBe(2)
    expect(preview.skippedCount).toBe(1)
    expect(preview.vaultSummaries).toHaveLength(2)
    expect(preview.activeVaultName).toBe('Personal')
  })

  it('aggregates upload/download bytes and excludes deletes', () => {
    const preview = buildIncrementalSyncPlanPreview({
      decisions: [
        decision('Personal/a.md', 'upload', { size: 1000 }),
        decision('Personal/b.md', 'download', { size: 2000 }),
        decision('Personal/c.md', 'conflict-resolved', { direction: 'upload', size: 3000 }),
        decision('Personal/d.md', 'conflict-resolved', { direction: 'download', size: 4000 }),
        decision('Personal/gone-local.md', 'delete-local', { size: 99999 }),
        decision('Personal/gone-remote.md', 'delete-remote', { size: 88888 }),
        decision('Work/e.md', 'upload', { size: 500 }),
        decision('Personal/skip.md', 'skip', { size: 777 })
      ],
      registeredVaults: ['Personal', 'Work'],
      diskVaultNames: ['Personal', 'Work'],
      activeVaultName: 'Personal'
    })

    expect(preview.totalUploadBytes).toBe(1000 + 3000 + 500)
    expect(preview.totalDownloadBytes).toBe(2000 + 4000)

    const personal = preview.vaultSummaries.find((s) => s.vaultName === 'Personal')
    const work = preview.vaultSummaries.find((s) => s.vaultName === 'Work')
    expect(personal).toMatchObject({
      upload: 1,
      download: 1,
      conflict: 2,
      deleteLocal: 1,
      deleteRemote: 1,
      uploadBytes: 4000,
      downloadBytes: 6000
    })
    expect(work).toMatchObject({
      upload: 1,
      uploadBytes: 500,
      downloadBytes: 0
    })

    const uploadItem = preview.items.find((i) => i.filePath === 'Personal/a.md')
    expect(uploadItem?.sizeBytes).toBe(1000)
    const conflictUpload = preview.items.find((i) => i.filePath === 'Personal/c.md')
    expect(conflictUpload).toMatchObject({
      action: 'conflict-resolved',
      direction: 'upload',
      sizeBytes: 3000
    })
  })

  it('does not count conflict bytes without direction', () => {
    const preview = buildIncrementalSyncPlanPreview({
      decisions: [decision('Personal/x.md', 'conflict-resolved', { size: 5000 })],
      registeredVaults: ['Personal'],
      diskVaultNames: ['Personal'],
      activeVaultName: 'Personal'
    })
    expect(preview.totalUploadBytes).toBe(0)
    expect(preview.totalDownloadBytes).toBe(0)
    expect(preview.vaultSummaries[0]).toMatchObject({
      conflict: 1,
      uploadBytes: 0,
      downloadBytes: 0
    })
  })

  it('formatIncrementalSyncPlanBytes renders human-readable sizes', () => {
    expect(formatIncrementalSyncPlanBytes(0)).toBe('0 B')
    expect(formatIncrementalSyncPlanBytes(512)).toBe('512 B')
    expect(formatIncrementalSyncPlanBytes(2048)).toBe('2 KB')
    expect(formatIncrementalSyncPlanBytes(12.4 * 1024 * 1024)).toBe('12.4 MB')
    expect(formatIncrementalSyncPlanBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })
})
