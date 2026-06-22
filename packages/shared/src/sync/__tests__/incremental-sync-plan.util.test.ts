import { describe, expect, it } from 'vitest'
import {
  buildIncrementalSyncBoundaryHints,
  buildIncrementalSyncBoundaryIssues,
  buildIncrementalSyncPlanPreview,
  resolveIncrementalSyncVaultScope
} from '../incremental-sync-plan.util'
import type { MergeDecision } from '../three-way-merge'

function decision(
  filePath: string,
  type: MergeDecision['type'],
  direction?: MergeDecision['direction']
): MergeDecision {
  return {
    filePath,
    type,
    direction,
    hash: 'h',
    size: 1,
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
          vaultScope: 'Archive'
        }
      ],
      manifestVaultScopes: new Set(['Personal', 'Archive', 'Work'])
    })
    expect(issues.diskVaultsNotInRegistry).toEqual(['Archive'])
    expect(issues.registryVaultsMissingOnDisk).toEqual(['Work'])
    expect(issues.unknownVaultPaths).toEqual(['Archive'])
  })

  it('ignores registry-only vaults without manifest data or pending changes', () => {
    const issues = buildIncrementalSyncBoundaryIssues({
      registeredVaults: ['Personal', 'C__Users_Desktop_OldVault'],
      diskVaultNames: ['Personal'],
      planItems: [
        {
          filePath: 'Personal/a.md',
          action: 'upload',
          vaultScope: 'Personal'
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
        { filePath: 'Archive/a.md', action: 'upload', vaultScope: 'Archive' },
        { filePath: 'haha/b.md', action: 'download', vaultScope: 'haha' }
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
          vaultScope: 'Personal'
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
})
