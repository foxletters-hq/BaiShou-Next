import { describe, expect, it, vi } from 'vitest'
import type { SyncManifest } from '@baishou/shared'
import {
  IncrementalSyncCheckpointCoordinator,
  LOCAL_CHECKPOINT_FLUSH_EVERY_N,
  ThrottledIncrementalFlush
} from '../mobile-incremental-flush.util'

describe('ThrottledIncrementalFlush', () => {
  it('达到批次阈值时触发 flush', () => {
    const flush = new ThrottledIncrementalFlush()
    for (let i = 0; i < LOCAL_CHECKPOINT_FLUSH_EVERY_N; i++) flush.bump()
    expect(flush.shouldFlush(false, LOCAL_CHECKPOINT_FLUSH_EVERY_N, 60_000)).toBe(true)
  })
})

describe('IncrementalSyncCheckpointCoordinator', () => {
  const manifest: SyncManifest = {
    version: 1,
    updatedAt: 1,
    deviceId: 'd',
    files: {}
  }

  it('多次变更后批量落盘并最终 flush', async () => {
    const coordinator = new IncrementalSyncCheckpointCoordinator()
    const localWrites: number[] = []
    const remoteWrites: number[] = []
    const ensureLocalFlushed = async () => {
      await coordinator.flushLocalIfNeeded(true, async () => {
        localWrites.push(1)
      }, async () => {})
    }

    for (let i = 0; i < 3; i++) {
      coordinator.noteManifest(manifest)
      coordinator.noteRemoteCheckpoint()
      await coordinator.flushLocalIfNeeded(false, async () => {
        localWrites.push(i)
      }, async () => {})
      await coordinator.flushRemoteIfNeeded(false, async () => {
        remoteWrites.push(i)
      }, ensureLocalFlushed)
    }

    expect(localWrites.length).toBe(0)
    expect(remoteWrites.length).toBe(0)

    await coordinator.finalizeAll(
      async () => {
        localWrites.push(99)
      },
      async () => {},
      async () => {
        remoteWrites.push(99)
      },
      async () => {}
    )

    expect(localWrites).toEqual([99])
    expect(remoteWrites).toEqual([99])
  })

  it('达到远端批次阈值前先 flush 本地 manifest', async () => {
    const coordinator = new IncrementalSyncCheckpointCoordinator()
    const order: string[] = []
    const saveLocal = vi.fn(async () => {
      order.push('local')
    })
    const saveSnapshot = vi.fn(async () => {})
    const uploadRemote = vi.fn(async () => {
      order.push('remote')
    })
    const ensureLocalFlushed = () => coordinator.flushLocalIfNeeded(true, saveLocal, saveSnapshot)

    for (let i = 0; i < 5; i++) {
      coordinator.noteManifest(manifest)
      coordinator.noteRemoteCheckpoint()
      await coordinator.flushRemoteIfNeeded(false, uploadRemote, ensureLocalFlushed)
    }

    expect(order).toEqual(['local', 'remote'])
    expect(saveLocal).toHaveBeenCalledTimes(1)
    expect(uploadRemote).toHaveBeenCalledTimes(1)
  })
})
