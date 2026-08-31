import { describe, expect, it, vi } from 'vitest'
import {
  applyDiaryGraphSurgicalDelete,
  commitNewlyDirtyGraphShardsIndexed,
  graphCollectionFromShardRelativePath
} from '../graph-surgical-delete'

describe('graphCollectionFromShardRelativePath', () => {
  it('reads the collection prefix', () => {
    expect(graphCollectionFromShardRelativePath('nodes/2026-08.jsonl')).toBe('nodes')
    expect(graphCollectionFromShardRelativePath('edges\\2026-08.jsonl')).toBe('edges')
    expect(graphCollectionFromShardRelativePath('extract-state/2026-08.jsonl')).toBe('extract-state')
    expect(graphCollectionFromShardRelativePath('other/2026-08.jsonl')).toBeNull()
  })
})

describe('commitNewlyDirtyGraphShardsIndexed', () => {
  it('commits only shards that were not pending before the rewrite', async () => {
    const commitIndexed = vi.fn().mockResolvedValue(undefined)
    const manager = {
      listPendingIndex: vi.fn().mockResolvedValue([
        { relativePath: 'nodes/2026-07.jsonl', contentHash: 'old-dirty' },
        { relativePath: 'nodes/2026-08.jsonl', contentHash: 'new' },
        { relativePath: 'edges/2026-08.jsonl', contentHash: 'new-edge' }
      ]),
      commitIndexed
    }
    const committed = await commitNewlyDirtyGraphShardsIndexed(manager, [
      { relativePath: 'nodes/2026-07.jsonl' }
    ])
    expect(committed).toBe(2)
    expect(commitIndexed).toHaveBeenCalledWith('nodes', 'nodes/2026-08.jsonl', 'new')
    expect(commitIndexed).toHaveBeenCalledWith('edges', 'edges/2026-08.jsonl', 'new-edge')
    expect(commitIndexed).not.toHaveBeenCalledWith(
      'nodes',
      'nodes/2026-07.jsonl',
      expect.anything()
    )
  })
})

describe('applyDiaryGraphSurgicalDelete', () => {
  it('rewrites files, soft-deletes SQLite, and does not rehydrate already-pending shards', async () => {
    const removeRecordsFromShard = vi.fn().mockResolvedValue(1)
    const commitIndexed = vi.fn().mockResolvedValue(undefined)
    const softDeleteNode = vi.fn().mockResolvedValue(undefined)
    const manager = {
      removeRecordsFromShard,
      listPendingIndex: vi
        .fn()
        .mockResolvedValueOnce([{ relativePath: 'nodes/2026-07.jsonl', contentHash: 'old' }])
        .mockResolvedValueOnce([
          { relativePath: 'nodes/2026-07.jsonl', contentHash: 'old' },
          { relativePath: 'edges/2026-08.jsonl', contentHash: 'rewritten' }
        ]),
      commitIndexed
    }
    const repo = {
      getNodeById: vi.fn().mockResolvedValue({
        id: 'n1',
        vaultId: 'vlt_aaaaaaaaaaaaaaaa',
        shardMonth: '2026-07'
      }),
      getEdgeById: vi.fn(),
      listEdgesTouching: vi.fn().mockResolvedValue([{ id: 'e2', shardMonth: '2026-08' }]),
      softDeleteNode,
      softDeleteEdge: vi.fn()
    }

    await applyDiaryGraphSurgicalDelete({
      kind: 'node',
      id: 'n1',
      vaultId: 'vlt_aaaaaaaaaaaaaaaa',
      manager,
      repo
    })

    expect(removeRecordsFromShard).toHaveBeenCalledWith('edges', '2026-08', ['e2'])
    expect(removeRecordsFromShard).toHaveBeenCalledWith('nodes', '2026-07', ['n1'])
    expect(softDeleteNode).toHaveBeenCalledWith('n1')
    expect(commitIndexed).toHaveBeenCalledWith('edges', 'edges/2026-08.jsonl', 'rewritten')
    expect(commitIndexed).not.toHaveBeenCalledWith(
      'nodes',
      'nodes/2026-07.jsonl',
      expect.anything()
    )
  })

  it('soft-deletes even when marking the shard indexed fails', async () => {
    const softDeleteEdge = vi.fn().mockResolvedValue(undefined)
    await applyDiaryGraphSurgicalDelete({
      kind: 'edge',
      id: 'e1',
      manager: {
        removeRecordsFromShard: vi.fn().mockResolvedValue(1),
        listPendingIndex: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ relativePath: 'edges/2026-03.jsonl', contentHash: 'n' }]),
        commitIndexed: vi.fn().mockRejectedValue(new Error('manifest locked'))
      },
      repo: {
        getNodeById: vi.fn(),
        getEdgeById: vi.fn().mockResolvedValue({ id: 'e1', shardMonth: '2026-03' }),
        listEdgesTouching: vi.fn(),
        softDeleteNode: vi.fn(),
        softDeleteEdge
      }
    })
    expect(softDeleteEdge).toHaveBeenCalledWith('e1')
  })
})
