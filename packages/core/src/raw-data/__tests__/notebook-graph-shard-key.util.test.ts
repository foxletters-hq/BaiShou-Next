import { describe, expect, it } from 'vitest'
import {
  NOTEBOOK_GRAPH_LEGACY_SHARD_KEY,
  isPresentNotebookGraphShardKey,
  isValidNotebookGraphShardKey,
  notebookGraphDeletedShardPaths,
  notebookGraphSourceIdFromSourceRef
} from '../notebook-graph-shard-key.util'
import { groupLegacyNotebookGraphRows } from '../../knowledge/notebook-graph-legacy-migrate.util'
import type { NotebookGraphEdgeRawRecord, NotebookGraphNodeRawRecord } from '@baishou/shared'

describe('notebook-graph-shard-key', () => {
  it('accepts source ids and _legacy, rejects months and paths', () => {
    expect(isValidNotebookGraphShardKey('src_ab12')).toBe(true)
    expect(isValidNotebookGraphShardKey('note_zz')).toBe(true)
    expect(isValidNotebookGraphShardKey('src1')).toBe(true)
    expect(isValidNotebookGraphShardKey(NOTEBOOK_GRAPH_LEGACY_SHARD_KEY)).toBe(true)
    expect(isValidNotebookGraphShardKey('2026-08')).toBe(false)
    expect(isValidNotebookGraphShardKey('../src1')).toBe(false)
    expect(isValidNotebookGraphShardKey('a/b')).toBe(false)
    expect(isPresentNotebookGraphShardKey(NOTEBOOK_GRAPH_LEGACY_SHARD_KEY)).toBe(false)
  })

  it('parses sourceRef prefix', () => {
    expect(notebookGraphSourceIdFromSourceRef('src_ab12#0')).toBe('src_ab12')
    expect(notebookGraphSourceIdFromSourceRef('2026-08#0')).toBeNull()
    expect(notebookGraphDeletedShardPaths('nb1', 'src5')).toEqual([
      'Notebooks/nb1/graph/nodes/src5.jsonl',
      'Notebooks/nb1/graph/edges/src5.jsonl'
    ])
  })
})

describe('groupLegacyNotebookGraphRows', () => {
  it('edges go to source shards; unassigned nodes go to _legacy', () => {
    const now = 1
    const edge: NotebookGraphEdgeRawRecord = {
      id: 'e1',
      schemaVersion: 1,
      vaultId: 'v1',
      vaultName: 'P',
      notebookId: 'nb1',
      fromId: 'n1',
      toId: 'n2',
      edgeType: 'mentions',
      props: {},
      validFrom: now,
      validTo: null,
      isCurrent: true,
      sourceKind: 'knowledge',
      sourceRef: 'src1#0',
      sourceExcerpt: '',
      sourceContentHash: null,
      confidence: 80,
      origin: 'ai',
      reviewStatus: 'approved',
      shardMonth: '2026-08',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }
    const n1: NotebookGraphNodeRawRecord = {
      id: 'n1',
      schemaVersion: 1,
      vaultId: 'v1',
      vaultName: 'P',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '甲',
      aliases: [],
      summary: '',
      props: {},
      mentionCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      origin: 'ai',
      shardMonth: '2026-08',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }
    const orphan: NotebookGraphNodeRawRecord = { ...n1, id: 'orphan', name: '无主' }
    const grouped = groupLegacyNotebookGraphRows({
      nodes: [n1, orphan],
      edges: [edge],
      extractStates: []
    })
    expect(grouped.edgesBySource.get('src1')?.map((e) => e.id)).toEqual(['e1'])
    expect(grouped.nodesBySource.get('src1')?.map((n) => n.id)).toEqual(['n1'])
    expect(grouped.nodesBySource.get('_legacy')?.map((n) => n.id)).toEqual(['orphan'])
  })
})
