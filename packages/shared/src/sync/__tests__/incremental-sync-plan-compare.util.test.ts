import { describe, expect, it } from 'vitest'
import type { IncrementalSyncPlanPreview } from '../../types/incremental-sync-plan.types'
import { hasIncrementalSyncPlanMaterialChange } from '../incremental-sync-plan-compare.util'
import {
  SyncConfirmNotReadyError,
  assertSyncConfirmAllowed,
  canExecuteIncrementalSyncPlan
} from '../sync-confirm-countdown.util'

function preview(
  overrides: Partial<IncrementalSyncPlanPreview> & Pick<IncrementalSyncPlanPreview, 'items'>
): IncrementalSyncPlanPreview {
  return {
    activeVaultName: 'vault-a',
    registeredVaults: ['vault-a'],
    vaultSummaries: [],
    warnings: [],
    changeCount: overrides.items.length,
    skippedCount: 0,
    boundaryIssues: {
      unknownVaultPaths: [],
      diskVaultsNotInRegistry: [],
      registryVaultsMissingOnDisk: []
    },
    requiresHighDivergenceConfirm: false,
    deletePropagationBlocked: false,
    ...overrides
  }
}

describe('incremental-sync-plan-compare.util', () => {
  it('detects item list changes', () => {
    const before = preview({
      items: [{ filePath: 'vault-a/a.md', action: 'upload', vaultScope: 'vault-a' }]
    })
    const after = preview({
      items: [{ filePath: 'vault-a/b.md', action: 'upload', vaultScope: 'vault-a' }]
    })
    expect(hasIncrementalSyncPlanMaterialChange(before, after)).toBe(true)
  })

  it('treats identical plans as unchanged', () => {
    const before = preview({
      items: [
        { filePath: 'vault-a/a.md', action: 'upload', vaultScope: 'vault-a' },
        { filePath: 'vault-a/b.md', action: 'download', vaultScope: 'vault-a' }
      ]
    })
    const after = preview({
      changeCount: 2,
      items: [
        { filePath: 'vault-a/b.md', action: 'download', vaultScope: 'vault-a' },
        { filePath: 'vault-a/a.md', action: 'upload', vaultScope: 'vault-a' }
      ]
    })
    expect(hasIncrementalSyncPlanMaterialChange(before, after)).toBe(false)
  })
})

describe('assertSyncConfirmAllowed', () => {
  it('fails closed when eligibleAt is missing for executable plans', () => {
    expect(() =>
      assertSyncConfirmAllowed({
        canExecuteSync: canExecuteIncrementalSyncPlan({
          changeCount: 2,
          deletePropagationBlocked: false
        }),
        eligibleAtMs: null
      })
    ).toThrow(SyncConfirmNotReadyError)
  })

  it('skips countdown for non-executable plans', () => {
    expect(() =>
      assertSyncConfirmAllowed({
        canExecuteSync: canExecuteIncrementalSyncPlan({
          changeCount: 0,
          deletePropagationBlocked: false
        }),
        eligibleAtMs: null
      })
    ).not.toThrow()
  })
})
