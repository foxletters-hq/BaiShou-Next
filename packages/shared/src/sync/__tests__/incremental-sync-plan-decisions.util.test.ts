import { describe, expect, it } from 'vitest'
import { buildIncrementalSyncPlanMergeResult } from '../incremental-sync-plan-decisions.util'
import type { SyncManifest } from '../../types/version-control.types'

function manifest(files: Record<string, string>): SyncManifest {
  return {
    version: 1,
    updatedAt: 0,
    deviceId: 'd',
    files: Object.fromEntries(
      Object.entries(files).map(([path, hash]) => [path, { hash, size: 1, lastModified: 0 }])
    )
  }
}

describe('buildIncrementalSyncPlanMergeResult', () => {
  it('未提供删除传播选择时保留 deleteBlock', () => {
    const remoteFiles = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`file-${i}.md`, `hash-${i}`])
    )
    const local = manifest({})
    const remote = manifest(remoteFiles)
    const ancestor = remote

    const result = buildIncrementalSyncPlanMergeResult(local, remote, ancestor)
    expect(result.deleteBlock).not.toBeNull()
    expect(result.deleteBlock?.direction).toBe('remote')
  })

  it('提供删除传播选择时应用 resolve 并清除 deleteBlock', () => {
    const remoteFiles = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`file-${i}.md`, `hash-${i}`])
    )
    const local = manifest({})
    const remote = manifest(remoteFiles)
    const ancestor = remote

    const result = buildIncrementalSyncPlanMergeResult(local, remote, ancestor, undefined, {
      deletePropagationChoice: 'push-local'
    })
    expect(result.deleteBlock).toBeNull()
    expect(result.decisions.some((d) => d.type === 'delete-remote')).toBe(true)
  })
})
