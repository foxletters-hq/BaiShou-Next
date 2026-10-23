import { describe, expect, it, vi } from 'vitest'
import { graphNodeIdForEntity } from '@baishou/shared'
import { splitGraphNode } from '../graph-split-node'
import {
  createLiveGraph,
  emptyManager,
  expectedSplitId,
  makeBareNode,
  makeEdge
} from './graph-split-node.test-helpers'

describe('splitGraphNode', () => {
  it('should write explicit-split as splitReason when reason is omitted', async () => {
    const { manager, repo, writes } = createLiveGraph({
      nodes: [makeBareNode()],
      edges: []
    })

    await splitGraphNode({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      label: '公司同事',
      edgeAssignments: [],
      now: 100,
      manager: manager as never,
      repo: repo as never
    })

    const splitWrite = writes.find(
      (item) => item.collection === 'nodes' && item.record.id === expectedSplitId
    )
    expect(splitWrite?.record.props).toEqual({ splitReason: 'explicit-split' })
  })

  it('should write the given reason as splitReason when reason is provided', async () => {
    const { manager, repo, writes } = createLiveGraph({
      nodes: [makeBareNode()],
      edges: []
    })

    await splitGraphNode({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      label: '公司同事',
      reason: 'user-confirmed',
      edgeAssignments: [],
      now: 100,
      manager: manager as never,
      repo: repo as never
    })

    const splitWrite = writes.find(
      (item) => item.collection === 'nodes' && item.record.id === expectedSplitId
    )
    expect(splitWrite?.record.props).toEqual({ splitReason: 'user-confirmed' })
  })

  it('should keep the first registeredAt when split is retried', async () => {
    const { manager, repo, writes } = createLiveGraph({
      nodes: [
        makeBareNode({
          propsJson: JSON.stringify({
            nameRegistry: [
              {
                discriminator: '同事',
                label: '公司同事',
                nodeId: 'already-split',
                registeredAt: 40
              }
            ]
          })
        }),
        {
          id: 'already-split',
          vaultId: 'v1',
          nodeType: 'person',
          name: '张三',
          aliases: ['张三'],
          summary: '已有摘要',
          propsJson: '{}',
          mentionCount: 0,
          firstSeenAt: 40,
          lastSeenAt: 40,
          origin: 'user',
          shardMonth: '2026-01',
          reviewStatus: 'approved',
          createdAt: 40,
          discriminator: '同事'
        }
      ],
      edges: []
    })

    await splitGraphNode({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      label: '公司同事',
      edgeAssignments: [],
      now: 100,
      manager: manager as never,
      repo: repo as never
    })

    const bareWrite = writes.find(
      (item) => item.collection === 'nodes' && item.record.id === 'bare-1'
    )
    const registry = (bareWrite?.record.props as { nameRegistry?: Array<{ registeredAt: number }> })
      ?.nameRegistry
    expect(registry?.[0]?.registeredAt).toBe(40)
  })

  it('should list leftover touching edges when only some edges are assigned', async () => {
    const { manager, repo } = createLiveGraph({
      nodes: [makeBareNode()],
      edges: [
        makeEdge({ id: 'e-split', fromId: 'bare-1', toId: 'place-1' }),
        makeEdge({ id: 'e-left', fromId: 'company-1', toId: 'bare-1', sourceRef: '2026-01-03' })
      ]
    })

    const result = await splitGraphNode({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      label: '公司同事',
      edgeAssignments: [{ edgeId: 'e-split', target: 'split' }],
      now: 100,
      manager: manager as never,
      repo: repo as never
    })

    expect(result.movedEdgeIds).toEqual(['e-split'])
    expect(result.unassignedEdgeIds).toEqual(['e-left'])
  })

  it('should remove a self-loop edge when both ends would become the split node', async () => {
    const { manager, repo, writes, removed } = createLiveGraph({
      nodes: [makeBareNode()],
      edges: [makeEdge({ id: 'e-loop', fromId: 'bare-1', toId: 'bare-1', edgeType: 'relates_to' })]
    })

    const result = await splitGraphNode({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      label: '公司同事',
      edgeAssignments: [{ edgeId: 'e-loop', target: 'split' }],
      now: 100,
      manager: manager as never,
      repo: repo as never
    })

    expect(result.movedEdgeIds).toEqual(['e-loop'])
    expect(writes.some((item) => item.collection === 'edges')).toBe(false)
    expect(removed).toEqual([{ collection: 'edges', shardMonth: '2026-01', ids: ['e-loop'] }])
  })

  it('should reject an empty discriminator when splitting', async () => {
    await expect(
      splitGraphNode({
        vaultId: 'v1',
        vaultName: 'Personal',
        bareNodeId: 'bare-1',
        discriminator: '',
        label: '公司同事',
        edgeAssignments: [],
        manager: emptyManager() as never,
        repo: {
          getNodeById: vi.fn(),
          listEdgesTouching: vi.fn()
        } as never
      })
    ).rejects.toThrow('区分信息不能为空')
  })

  it('should reject a whitespace-only discriminator when splitting', async () => {
    await expect(
      splitGraphNode({
        vaultId: 'v1',
        vaultName: 'Personal',
        bareNodeId: 'bare-1',
        discriminator: '   ',
        label: '公司同事',
        edgeAssignments: [],
        manager: emptyManager() as never,
        repo: {
          getNodeById: vi.fn(),
          listEdgesTouching: vi.fn()
        } as never
      })
    ).rejects.toThrow('区分信息不能为空')
  })

  it('should reject a missing bare node when splitting', async () => {
    await expect(
      splitGraphNode({
        vaultId: 'v1',
        vaultName: 'Personal',
        bareNodeId: 'missing',
        discriminator: '同事',
        label: '公司同事',
        edgeAssignments: [],
        manager: emptyManager() as never,
        repo: {
          getNodeById: vi.fn(async () => null),
          listEdgesTouching: vi.fn()
        } as never
      })
    ).rejects.toThrow('裸名节点不存在')
  })

  it('should reject a vault mismatch when splitting', async () => {
    await expect(
      splitGraphNode({
        vaultId: 'v1',
        vaultName: 'Personal',
        bareNodeId: 'bare-1',
        discriminator: '同事',
        label: '公司同事',
        edgeAssignments: [],
        manager: emptyManager() as never,
        repo: {
          getNodeById: vi.fn(async () => makeBareNode({ vaultId: 'other-vault' })),
          listEdgesTouching: vi.fn()
        } as never
      })
    ).rejects.toThrow('裸名节点不属于当前库')
  })

  it('should reject an entry node when splitting', async () => {
    await expect(
      splitGraphNode({
        vaultId: 'v1',
        vaultName: 'Personal',
        bareNodeId: 'bare-1',
        discriminator: '同事',
        label: '日记',
        edgeAssignments: [],
        manager: emptyManager() as never,
        repo: {
          getNodeById: vi.fn(async () => makeBareNode({ nodeType: 'entry', name: '2026-01-01' })),
          listEdgesTouching: vi.fn()
        } as never
      })
    ).rejects.toThrow('日记锚点不能拆分')
  })

  it('should produce the same split node id when discriminator only differs by case and spacing', async () => {
    const { manager, repo } = createLiveGraph({
      nodes: [makeBareNode()],
      edges: []
    })

    const result = await splitGraphNode({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: ' work   colleague ',
      label: 'Work Colleague',
      edgeAssignments: [],
      now: 100,
      manager: manager as never,
      repo: repo as never
    })

    expect(result.splitNodeId).toBe(graphNodeIdForEntity('v1', 'person', '张三', 'Work Colleague'))
  })
})
