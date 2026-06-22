import { describe, expect, it } from 'vitest'
import {
  createPartProgressReporter,
  createThrottledByteReporter,
  isIncrementalSyncTransferDecision,
  mergeIncrementalSyncProgress,
  resolveSyncFileConcurrency,
  resolveSyncFileConcurrencyFromDecisions,
  shouldDeferRemoteManifestCheckpoint,
  shouldTrustRemoteHashAfterDownload
} from '../mobile-incremental-sync-progress.util'

describe('mergeIncrementalSyncProgress', () => {
  it('保留阶段更新时的字节进度', () => {
    const prev = {
      phase: 'syncing' as const,
      current: 1,
      total: 10,
      fileName: 'a.md',
      action: 'upload' as const,
      fileBytesDone: 500,
      fileBytesTotal: 1000
    }
    const next = {
      phase: 'syncing' as const,
      current: 1,
      total: 10,
      fileName: 'a.md',
      action: 'upload' as const,
      statusText: '正在读取文件…'
    }
    const merged = mergeIncrementalSyncProgress(prev, next)
    expect(merged.fileBytesDone).toBe(500)
    expect(merged.fileBytesTotal).toBe(1000)
    expect(merged.statusText).toBe('正在读取文件…')
  })

  it('无 fileName 时不继承上一份字节进度', () => {
    const prev = {
      phase: 'syncing' as const,
      current: 1,
      total: 10,
      fileName: 'a.md',
      fileBytesDone: 800,
      fileBytesTotal: 1000
    }
    const next = {
      phase: 'finalizing' as const,
      current: 1,
      total: 1,
      statusText: '正在保存同步状态…'
    }
    const merged = mergeIncrementalSyncProgress(prev, next)
    expect(merged.fileBytesDone).toBeUndefined()
    expect(merged.fileBytesTotal).toBeUndefined()
  })

  it('同文件字节进度不倒退', () => {
    const prev = {
      phase: 'syncing' as const,
      current: 1,
      total: 10,
      fileName: 'a.md',
      fileBytesDone: 800,
      fileBytesTotal: 1000
    }
    const next = {
      phase: 'syncing' as const,
      current: 1,
      total: 10,
      fileName: 'a.md',
      fileBytesDone: 200,
      fileBytesTotal: 1000
    }
    const merged = mergeIncrementalSyncProgress(prev, next)
    expect(merged.fileBytesDone).toBe(800)
  })

  it('同文件重新开始传输时允许归零', () => {
    const prev = {
      phase: 'syncing' as const,
      current: 1,
      total: 10,
      fileName: 'a.md',
      fileBytesDone: 1000,
      fileBytesTotal: 1000
    }
    const next = {
      phase: 'syncing' as const,
      current: 1,
      total: 10,
      fileName: 'a.md',
      fileBytesDone: 0,
      fileBytesTotal: 2000,
      action: 'upload' as const
    }
    const merged = mergeIncrementalSyncProgress(prev, next)
    expect(merged.fileBytesDone).toBe(0)
    expect(merged.fileBytesTotal).toBe(2000)
  })
})

describe('shouldTrustRemoteHashAfterDownload', () => {
  it('size 一致时信任远程 hash', () => {
    expect(
      shouldTrustRemoteHashAfterDownload(100, {
        hash: 'abc',
        size: 100,
        lastModified: 1
      })
    ).toBe(true)
  })

  it('size 不一致时不信任', () => {
    expect(
      shouldTrustRemoteHashAfterDownload(99, {
        hash: 'abc',
        size: 100,
        lastModified: 1
      })
    ).toBe(false)
  })
})

describe('isIncrementalSyncTransferDecision', () => {
  it('跳过 delete/skip', () => {
    expect(isIncrementalSyncTransferDecision({ type: 'skip' })).toBe(false)
    expect(isIncrementalSyncTransferDecision({ type: 'delete-local' })).toBe(false)
    expect(isIncrementalSyncTransferDecision({ type: 'upload' })).toBe(true)
    expect(isIncrementalSyncTransferDecision({ type: 'conflict-resolved' })).toBe(true)
  })
})

describe('createPartProgressReporter', () => {
  it('并发 part 聚合为单调总进度', () => {
    const reports: number[] = []
    const report = createPartProgressReporter(3, 300, (done) => reports.push(done))
    report(1, 100)
    report(0, 100)
    report(2, 100)
    expect(reports).toEqual([100, 200, 300])
  })
})

describe('createThrottledByteReporter', () => {
  it('完成时必定上报最终字节', () => {
    const values: number[] = []
    const report = createThrottledByteReporter((w) => values.push(w), 10_000)
    report(50, 100)
    report(100, 100)
    expect(values).toContain(100)
  })
})

describe('resolveSyncFileConcurrency', () => {
  it('有大文件时降为 1', () => {
    expect(resolveSyncFileConcurrency([{ size: 100 }, { size: 3 * 1024 * 1024 }], 5)).toBe(1)
  })

  it('无大文件时保留配置', () => {
    expect(resolveSyncFileConcurrency([{ size: 100 }, { size: 200 }], 5)).toBe(5)
  })

  it('空列表时保留配置', () => {
    expect(resolveSyncFileConcurrency([], 5)).toBe(5)
  })
})

describe('shouldDeferRemoteManifestCheckpoint', () => {
  it('所有变更类型均批量推送远端 manifest', () => {
    expect(shouldDeferRemoteManifestCheckpoint({ type: 'download' })).toBe(true)
    expect(shouldDeferRemoteManifestCheckpoint({ type: 'upload' })).toBe(true)
    expect(shouldDeferRemoteManifestCheckpoint({ type: 'delete-remote' })).toBe(true)
    expect(
      shouldDeferRemoteManifestCheckpoint({ type: 'conflict-resolved', direction: 'upload' })
    ).toBe(true)
  })
})

describe('resolveSyncFileConcurrencyFromDecisions', () => {
  it('大文件 skip 不计入降并发', () => {
    expect(
      resolveSyncFileConcurrencyFromDecisions(
        [
          { type: 'skip', size: 10 * 1024 * 1024 },
          { type: 'upload', size: 100 }
        ],
        5
      )
    ).toBe(5)
  })

  it('大文件 upload 计入降并发', () => {
    expect(
      resolveSyncFileConcurrencyFromDecisions(
        [
          { type: 'skip', size: 10 * 1024 * 1024 },
          { type: 'upload', size: 3 * 1024 * 1024 }
        ],
        5
      )
    ).toBe(1)
  })
})
