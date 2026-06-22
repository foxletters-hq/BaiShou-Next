import { describe, expect, it } from 'vitest'
import {
  buildIncrementalSyncPlanReuseBaseline,
  buildSyncManifestRemovedFingerprint,
  evaluateIncrementalSyncPlanDrift,
  hasRemoteManifestDrift,
  INCREMENTAL_SYNC_PLAN_REUSE_TTL_MS,
  shouldReplanIncrementalSyncOnConfirm
} from '../incremental-sync-plan-reuse.util'
import type { SyncManifest } from '../../types/version-control.types'

const emptyManifest = (): SyncManifest => ({
  version: 1,
  updatedAt: 1,
  deviceId: 'd',
  files: {}
})

const manifestWithFiles = (files: SyncManifest['files']): SyncManifest => ({
  ...emptyManifest(),
  files
})

describe('hasRemoteManifestDrift', () => {
  it('files 未变但 removed 变化时判定为漂移', () => {
    const baseline = {
      ...manifestWithFiles({
        'a.md': { hash: '1', size: 10, lastModified: 100 }
      }),
      removed: {
        'old.md': { hash: 'x', size: 1, removedAt: 10, deviceId: 'd' }
      }
    }
    const current = {
      ...baseline,
      removed: {
        'old.md': { hash: 'x', size: 1, removedAt: 11, deviceId: 'd' }
      }
    }
    expect(hasRemoteManifestDrift(baseline, current)).toBe(true)
  })

  it('removed 未变时 files 的 size/mtime 变化仍判定为漂移', () => {
    const baseline = manifestWithFiles({
      'a.md': { hash: '1', size: 10, lastModified: 100 }
    })
    const current = manifestWithFiles({
      'a.md': { hash: '1', size: 11, lastModified: 100 }
    })
    expect(hasRemoteManifestDrift(baseline, current)).toBe(true)
  })
})

describe('evaluateIncrementalSyncPlanDrift', () => {
  it('baseline 能检测远端 removed 漂移', () => {
    const local = emptyManifest()
    const remoteBefore = {
      ...emptyManifest(),
      removed: { 'x.md': { hash: 'h', size: 1, removedAt: 1, deviceId: 'd' } }
    }
    const remoteAfter = {
      ...remoteBefore,
      removed: {
        'x.md': { hash: 'h', size: 1, removedAt: 2, deviceId: 'd' },
        'y.md': { hash: 'h2', size: 2, removedAt: 3, deviceId: 'd' }
      }
    }
    const baseline = buildIncrementalSyncPlanReuseBaseline(local, remoteBefore, 1000)
    const drift = evaluateIncrementalSyncPlanDrift(baseline, local, remoteAfter, 2000)
    expect(drift.remoteManifestDrifted).toBe(true)
    expect(drift.localTreeDrifted).toBe(false)
    expect(drift.ttlExpired).toBe(false)
  })

  it('TTL 过期时标记 ttlExpired', () => {
    const manifest = emptyManifest()
    const baseline = buildIncrementalSyncPlanReuseBaseline(manifest, manifest, 0)
    const drift = evaluateIncrementalSyncPlanDrift(
      baseline,
      manifest,
      manifest,
      INCREMENTAL_SYNC_PLAN_REUSE_TTL_MS + 1
    )
    expect(drift.ttlExpired).toBe(true)
  })
})

describe('shouldReplanIncrementalSyncOnConfirm', () => {
  const preview = {
    deletePropagationBlocked: false,
    requiresHighDivergenceConfirm: false
  }

  it('已选删除传播时强制重规划', () => {
    expect(
      shouldReplanIncrementalSyncOnConfirm(
        {
          deletePropagationBlocked: true,
          requiresHighDivergenceConfirm: false,
          requiresDeletePropagationChoice: true
        },
        Date.now(),
        { deletePropagationChoiceProvided: true }
      )
    ).toBe(true)
  })
})

describe('buildSyncManifestRemovedFingerprint', () => {
  it('按路径排序生成稳定指纹', () => {
    const manifest: SyncManifest = {
      ...emptyManifest(),
      removed: {
        'b.md': { hash: '2', size: 2, removedAt: 2, deviceId: 'd' },
        'a.md': { hash: '1', size: 1, removedAt: 1, deviceId: 'd' }
      }
    }
    expect(buildSyncManifestRemovedFingerprint(manifest)).toBe(
      'a.md\t1\t1\nb.md\t2\t2'
    )
  })
})
