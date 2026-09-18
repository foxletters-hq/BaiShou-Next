import { describe, expect, it, vi } from 'vitest'
import type { GraphEdgeRawRecord } from '@baishou/shared'
import {
  remapTouchingEdges,
  type RemapTouchingEdgeInput,
  type RemapTouchingEdgesWriter
} from '../graph-remap-touching-edges'

function edge(
  partial: Partial<RemapTouchingEdgeInput> & Pick<RemapTouchingEdgeInput, 'id'>
): RemapTouchingEdgeInput {
  return {
    fromId: 'bare',
    toId: 'org',
    edgeType: 'role_of',
    propsJson: '{"k":1}',
    validFrom: 1,
    validTo: null,
    isCurrent: true,
    sourceKind: 'diary',
    sourceRef: 'd1.md',
    sourceExcerpt: '片段',
    sourceContentHash: null,
    confidence: 80,
    origin: 'ai',
    reviewStatus: 'approved',
    shardMonth: '2026-01',
    createdAt: 10,
    ...partial
  }
}

describe('remapTouchingEdges', () => {
  it('should keep the original edge id when swapping an endpoint', async () => {
    const writes: GraphEdgeRawRecord[] = []
    const manager: RemapTouchingEdgesWriter = {
      writeRecord: vi.fn(async (record) => {
        writes.push(record)
      }),
      removeRecordsFromShard: vi.fn(async () => 0)
    }
    const result = await remapTouchingEdges({
      vaultId: 'v1',
      vaultName: '库',
      fromNodeId: 'bare',
      toNodeId: 'split',
      edges: [edge({ id: 'e1' })],
      now: 99,
      fallbackShardMonth: '2026-01',
      manager
    })
    expect(result.movedEdgeIds).toEqual(['e1'])
    expect(writes[0]).toMatchObject({
      id: 'e1',
      fromId: 'split',
      toId: 'org',
      schemaVersion: 1,
      props: { k: 1 },
      updatedAt: 99
    })
  })

  it('should remove a self-loop instead of writing it back', async () => {
    const removed: string[] = []
    const manager: RemapTouchingEdgesWriter = {
      writeRecord: vi.fn(),
      removeRecordsFromShard: vi.fn(async (_c, _s, ids) => {
        removed.push(...ids)
        return ids.length
      })
    }
    await remapTouchingEdges({
      vaultId: 'v1',
      vaultName: '库',
      fromNodeId: 'bare',
      toNodeId: 'split',
      edges: [edge({ id: 'loop', fromId: 'bare', toId: 'bare' })],
      now: 1,
      fallbackShardMonth: '2026-01',
      manager
    })
    expect(removed).toEqual(['loop'])
    expect(manager.writeRecord).not.toHaveBeenCalled()
  })

  it('should skip an edge that no longer touches the source node', async () => {
    const manager: RemapTouchingEdgesWriter = {
      writeRecord: vi.fn(),
      removeRecordsFromShard: vi.fn(async () => 0)
    }
    const result = await remapTouchingEdges({
      vaultId: 'v1',
      vaultName: '库',
      fromNodeId: 'bare',
      toNodeId: 'split',
      edges: [edge({ id: 'moved', fromId: 'split', toId: 'org' })],
      now: 1,
      fallbackShardMonth: '2026-01',
      manager
    })
    expect(result.movedEdgeIds).toEqual([])
    expect(manager.writeRecord).not.toHaveBeenCalled()
  })

  it('should skip edges rejected by shouldRemap', async () => {
    const manager: RemapTouchingEdgesWriter = {
      writeRecord: vi.fn(),
      removeRecordsFromShard: vi.fn(async () => 0)
    }
    await remapTouchingEdges({
      vaultId: 'v1',
      vaultName: '库',
      fromNodeId: 'bare',
      toNodeId: 'split',
      edges: [edge({ id: 'keep' })],
      now: 1,
      fallbackShardMonth: '2026-01',
      manager,
      shouldRemap: () => false
    })
    expect(manager.writeRecord).not.toHaveBeenCalled()
  })
})
