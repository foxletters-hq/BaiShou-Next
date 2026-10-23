import { describe, expect, it, vi } from 'vitest'
import { removeGraphEdge, removeGraphNodeAndEdges } from '../graph-tombstone-cascade'

describe('graph-tombstone-cascade', () => {
  it('removes touching edges from their month shards before the node', async () => {
    const removeRecordsFromShard = vi.fn().mockResolvedValue(1)
    const repo = {
      getNodeById: vi.fn().mockResolvedValue({
        id: 'n1',
        vaultId: 'vlt_aaaaaaaaaaaaaaaa',
        shardMonth: '2026-07'
      }),
      getEdgeById: vi.fn(),
      listEdgesTouching: vi.fn().mockResolvedValue([
        { id: 'e1', shardMonth: '2026-07' },
        { id: 'e2', shardMonth: '2026-08' }
      ])
    }
    await removeGraphNodeAndEdges({ removeRecordsFromShard }, repo, 'n1', 'vlt_aaaaaaaaaaaaaaaa')
    expect(removeRecordsFromShard).toHaveBeenCalledWith('edges', '2026-07', ['e1'])
    expect(removeRecordsFromShard).toHaveBeenCalledWith('edges', '2026-08', ['e2'])
    expect(removeRecordsFromShard).toHaveBeenCalledWith('nodes', '2026-07', ['n1'])
  })

  it('removes an edge from its month shard', async () => {
    const removeRecordsFromShard = vi.fn().mockResolvedValue(1)
    await removeGraphEdge(
      { removeRecordsFromShard },
      {
        getNodeById: vi.fn(),
        getEdgeById: vi.fn().mockResolvedValue({ id: 'e1', shardMonth: '2026-03' }),
        listEdgesTouching: vi.fn()
      },
      'e1'
    )
    expect(removeRecordsFromShard).toHaveBeenCalledWith('edges', '2026-03', ['e1'])
  })

  it('still removes the node from listed shards when SQLite has no row', async () => {
    const removeRecordsFromShard = vi.fn().mockResolvedValue(1)
    const listShards = vi.fn().mockResolvedValue([
      { relativePath: 'nodes/2026-07.jsonl', shardMonth: '2026-07' },
      { relativePath: 'edges/2026-07.jsonl', shardMonth: '2026-07' }
    ])
    await removeGraphNodeAndEdges(
      { removeRecordsFromShard, listShards },
      {
        getNodeById: vi.fn().mockResolvedValue(null),
        getEdgeById: vi.fn(),
        listEdgesTouching: vi.fn()
      },
      'ghost'
    )
    expect(removeRecordsFromShard).toHaveBeenCalledWith('nodes', '2026-07', ['ghost'])
    expect(removeRecordsFromShard).not.toHaveBeenCalledWith('edges', '2026-07', ['ghost'])
  })
})
