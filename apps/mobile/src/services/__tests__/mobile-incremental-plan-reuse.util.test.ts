import { describe, expect, it } from 'vitest'
import type { IncrementalSyncPlanPreview } from '@baishou/shared'
import {
  buildSyncTreeFingerprint,
  hasLocalSyncTreeDrift,
  hasRemoteManifestDrift,
  INCREMENTAL_SYNC_PLAN_REUSE_TTL_MS,
  readVaultRegistryFingerprint,
  shouldReplanIncrementalSyncOnConfirm,
  summarizeScannedSyncFiles,
  summarizeSyncManifestFiles
} from '../mobile-incremental-plan-reuse.util'

const basePreview: IncrementalSyncPlanPreview = {
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
  }
}

describe('shouldReplanIncrementalSyncOnConfirm', () => {
  it('无规划时间时强制重规划', () => {
    expect(shouldReplanIncrementalSyncOnConfirm(basePreview, null)).toBe(true)
  })

  it('TTL 内且低风险时可复用', () => {
    expect(shouldReplanIncrementalSyncOnConfirm(basePreview, Date.now())).toBe(false)
  })

  it('TTL 过期后重规划', () => {
    const staleAt = Date.now() - INCREMENTAL_SYNC_PLAN_REUSE_TTL_MS - 1
    expect(shouldReplanIncrementalSyncOnConfirm(basePreview, staleAt)).toBe(true)
  })

  it('用户已确认高差异时可复用规划', () => {
    expect(
      shouldReplanIncrementalSyncOnConfirm(
        { ...basePreview, requiresHighDivergenceConfirm: true },
        Date.now(),
        { highDivergenceConfirmed: true }
      )
    ).toBe(false)
  })

  it('远端 manifest 漂移时重规划', () => {
    expect(
      shouldReplanIncrementalSyncOnConfirm(basePreview, Date.now(), {
        remoteManifestDrifted: true
      })
    ).toBe(true)
  })

  it('用户已选择删除传播处理方式时强制重规划以刷新预览', () => {
    expect(
      shouldReplanIncrementalSyncOnConfirm(
        { ...basePreview, deletePropagationBlocked: true, requiresDeletePropagationChoice: true },
        Date.now(),
        { deletePropagationChoiceProvided: true }
      )
    ).toBe(true)
  })

  it('删除传播阻断且未选择处理方式时重规划', () => {
    expect(
      shouldReplanIncrementalSyncOnConfirm(
        { ...basePreview, deletePropagationBlocked: true, requiresDeletePropagationChoice: true },
        Date.now()
      )
    ).toBe(true)
  })
})

describe('sync tree fingerprint drift', () => {
  const baselineManifest = {
    version: 1,
    updatedAt: 1,
    deviceId: 'd',
    files: {
      'a.md': { hash: '1', size: 10, lastModified: 100 },
      'b.md': { hash: '2', size: 20, lastModified: 50 }
    }
  }

  it('修改非 max-mtime 文件也能检测到漂移', () => {
    const baseline = summarizeSyncManifestFiles(baselineManifest)
    const current = summarizeScannedSyncFiles([
      { relPath: 'a.md', size: 10, mtimeMs: 100 },
      { relPath: 'b.md', size: 20, mtimeMs: 80 }
    ])
    expect(hasLocalSyncTreeDrift(baseline, current)).toBe(true)
  })

  it('远端 manifest 指纹变化可检测', () => {
    const after = {
      ...baselineManifest,
      files: {
        ...baselineManifest.files,
        'b.md': { hash: '3', size: 21, lastModified: 80 }
      }
    }
    expect(hasRemoteManifestDrift(baselineManifest, after)).toBe(true)
    expect(buildSyncTreeFingerprint([])).toBe('')
  })

  it('仅 removed 变化也可检测远端漂移', () => {
    const withRemoved = {
      ...baselineManifest,
      removed: {
        'gone.md': { hash: '9', size: 1, removedAt: 1, deviceId: 'd' }
      }
    }
    const withRemovedChanged = {
      ...withRemoved,
      removed: {
        'gone.md': { hash: '9', size: 1, removedAt: 2, deviceId: 'd' }
      }
    }
    expect(hasRemoteManifestDrift(withRemoved, withRemovedChanged)).toBe(true)
  })
})

describe('readVaultRegistryFingerprint', () => {
  it('读取注册表指纹', async () => {
    const fp = await readVaultRegistryFingerprint(
      {
        exists: async () => true,
        stat: async () => ({ mtimeMs: 42 }),
        readFile: async () => '{"vaults":[]}'
      },
      '/root/vault_registry.json'
    )
    expect(fp).toContain('42:')
    expect(fp).toContain('{"vaults":[]}')
  })
})
