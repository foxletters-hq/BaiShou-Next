import { describe, expect, it } from 'vitest'
import type { IncrementalSyncPlanPreview } from '../../types/incremental-sync-plan.types'
import type { SyncManifest } from '../../types/version-control.types'
import {
  resolveIncrementalSyncConfirmReplan,
  shouldRequireIncrementalSyncReconfirmAfterReplan
} from '../incremental-sync-confirm-replan.util'
import {
  buildIncrementalSyncPlanReuseBaseline,
  INCREMENTAL_SYNC_PLAN_REUSE_TTL_MS
} from '../incremental-sync-plan-reuse.util'

function preview(
  overrides: Partial<IncrementalSyncPlanPreview> = {}
): IncrementalSyncPlanPreview {
  return {
    activeVaultName: 'Personal',
    registeredVaults: ['Personal'],
    vaultSummaries: [],
    changeCount: 1,
    skippedCount: 0,
    deletePropagationBlocked: false,
    requiresHighDivergenceConfirm: false,
    items: [{ action: 'upload', filePath: 'a.md', vaultScope: 'Personal' }],
    warnings: [],
    boundaryIssues: {
      unknownVaultPaths: [],
      diskVaultsNotInRegistry: [],
      registryVaultsMissingOnDisk: []
    },
    ...overrides
  }
}

const emptyManifest = (): SyncManifest => ({
  version: 1,
  updatedAt: 1,
  deviceId: 'd',
  files: {}
})

describe('resolveIncrementalSyncConfirmReplan', () => {
  it('优先使用调用方传入的漂移结果', () => {
    const result = resolveIncrementalSyncConfirmReplan({
      stalePreview: preview(),
      planPreparedAtMs: Date.now(),
      vaultRegistryChanged: false,
      highDivergenceConfirmed: false,
      deletePropagationChoiceProvided: false,
      drift: { localTreeDrifted: false, remoteManifestDrifted: true }
    })
    expect(result.remoteManifestDrifted).toBe(true)
    expect(result.needsReplan).toBe(true)
  })

  it('无 drift 时用 planReuseBaseline 与现场 manifest 评估 removed 漂移', () => {
    const local = emptyManifest()
    const remoteBefore = {
      ...emptyManifest(),
      removed: { 'x.md': { hash: 'h', size: 1, removedAt: 1, deviceId: 'd' } }
    }
    const remoteAfter = {
      ...remoteBefore,
      removed: {
        'x.md': { hash: 'h', size: 1, removedAt: 2, deviceId: 'd' }
      }
    }
    const baseline = buildIncrementalSyncPlanReuseBaseline(local, remoteBefore, Date.now())

    const result = resolveIncrementalSyncConfirmReplan({
      stalePreview: preview(),
      planPreparedAtMs: baseline.preparedAtMs,
      planReuseBaseline: baseline,
      vaultRegistryChanged: false,
      highDivergenceConfirmed: false,
      deletePropagationChoiceProvided: false,
      localManifest: local,
      remoteManifest: remoteAfter
    })

    expect(result.remoteManifestDrifted).toBe(true)
    expect(result.needsReplan).toBe(true)
  })

  it('TTL 过期时强制 replan', () => {
    const result = resolveIncrementalSyncConfirmReplan({
      stalePreview: preview(),
      planPreparedAtMs: Date.now() - INCREMENTAL_SYNC_PLAN_REUSE_TTL_MS - 1,
      vaultRegistryChanged: false,
      highDivergenceConfirmed: false,
      deletePropagationChoiceProvided: false
    })
    expect(result.needsReplan).toBe(true)
  })

  it('已选删除传播时强制 replan 以刷新预览', () => {
    const result = resolveIncrementalSyncConfirmReplan({
      stalePreview: preview({
        deletePropagationBlocked: true,
        requiresDeletePropagationChoice: true
      }),
      planPreparedAtMs: Date.now(),
      vaultRegistryChanged: false,
      highDivergenceConfirmed: false,
      deletePropagationChoiceProvided: true
    })
    expect(result.needsReplan).toBe(true)
  })

  it('vault 注册表变更时 replan', () => {
    const result = resolveIncrementalSyncConfirmReplan({
      stalePreview: preview(),
      planPreparedAtMs: Date.now(),
      vaultRegistryChanged: true,
      highDivergenceConfirmed: false,
      deletePropagationChoiceProvided: false
    })
    expect(result.needsReplan).toBe(true)
  })
})

describe('shouldRequireIncrementalSyncReconfirmAfterReplan', () => {
  it('未 replan 时不要二次确认', () => {
    expect(
      shouldRequireIncrementalSyncReconfirmAfterReplan(
        false,
        preview(),
        preview({ items: [{ action: 'download', filePath: 'b.md', vaultScope: 'Personal' }] }),
        false
      )
    ).toBe(false)
  })

  it('replan 后规划实质变化时要求二次确认', () => {
    const stale = preview({
      items: [{ action: 'upload', filePath: 'a.md', vaultScope: 'Personal' }]
    })
    const fresh = preview({
      items: [{ action: 'download', filePath: 'b.md', vaultScope: 'Personal' }]
    })
    expect(shouldRequireIncrementalSyncReconfirmAfterReplan(true, stale, fresh, false)).toBe(true)
  })

  it('已选删除传播时跳过二次确认', () => {
    const stale = preview({
      items: [{ action: 'upload', filePath: 'a.md', vaultScope: 'Personal' }]
    })
    const fresh = preview({
      items: [{ action: 'delete-remote', filePath: 'gone.md', vaultScope: 'Personal' }]
    })
    expect(shouldRequireIncrementalSyncReconfirmAfterReplan(true, stale, fresh, true)).toBe(false)
  })
})
