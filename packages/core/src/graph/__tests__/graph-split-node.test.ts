import { describe, expect, it } from 'vitest'
import { splitGraphNode } from '../graph-split-node'
import {
  createLiveGraph,
  expectedSplitId,
  makeBareNode,
  makeEdge
} from './graph-split-node.test-helpers'

describe('splitGraphNode', () => {
  it('should write registry, create the split node, and remap only assigned edges when splitting a bare node', async () => {
    const { manager, repo, writes } = createLiveGraph({
      nodes: [makeBareNode()],
      edges: [
        makeEdge({ id: 'e-split', fromId: 'bare-1', toId: 'place-1' }),
        makeEdge({ id: 'e-keep', fromId: 'bare-1', toId: 'place-2', sourceRef: '2026-01-02' })
      ]
    })

    const result = await splitGraphNode({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      label: '公司同事',
      summary: '公司里的张三',
      edgeAssignments: [
        { edgeId: 'e-split', target: 'split' },
        { edgeId: 'e-keep', target: 'bare' }
      ],
      now: 100,
      manager: manager as never,
      repo: repo as never
    })

    expect(result).toEqual({
      bareNodeId: 'bare-1',
      splitNodeId: expectedSplitId,
      movedEdgeIds: ['e-split'],
      unassignedEdgeIds: []
    })

    const bareWrite = writes.find(
      (item) => item.collection === 'nodes' && item.record.id === 'bare-1'
    )
    const splitWrite = writes.find(
      (item) => item.collection === 'nodes' && item.record.id === expectedSplitId
    )
    const movedEdge = writes.find(
      (item) => item.collection === 'edges' && item.record.id === 'e-split'
    )
    const keptEdge = writes.find(
      (item) => item.collection === 'edges' && item.record.id === 'e-keep'
    )

    expect(bareWrite?.record.name).toBe('张三')
    expect(bareWrite?.record.aliases).toEqual(['张三'])
    expect(bareWrite?.record.nodeType).toBe('person')
    expect(bareWrite?.record.createdAt).toBe(10)
    expect(bareWrite?.record.firstSeenAt).toBe(10)
    expect(bareWrite?.record.updatedAt).toBe(100)
    expect(bareWrite?.record.props).toEqual(
      expect.objectContaining({
        nameRegistry: [
          {
            discriminator: '同事',
            label: '公司同事',
            nodeId: expectedSplitId,
            registeredAt: 100
          }
        ]
      })
    )

    expect(splitWrite?.record.name).toBe('张三')
    expect(splitWrite?.record.discriminator).toBe('同事')
    expect(splitWrite?.record.summary).toBe('公司里的张三')
    expect(splitWrite?.record.origin).toBe('user')
    expect(splitWrite?.record.reviewStatus).toBe('approved')
    expect(splitWrite?.record.shardMonth).toBe('2026-01')
    expect(splitWrite?.record.mentionCount).toBe(0)
    expect(splitWrite?.record.aliases).toEqual(['张三'])
    expect(splitWrite?.record.firstSeenAt).toBe(100)
    expect(splitWrite?.record.lastSeenAt).toBe(100)
    expect(splitWrite?.record.createdAt).toBe(100)
    expect(splitWrite?.record.updatedAt).toBe(100)

    expect(movedEdge?.record.fromId).toBe(expectedSplitId)
    expect(movedEdge?.record.toId).toBe('place-1')
    expect(movedEdge?.record.id).toBe('e-split')
    expect(keptEdge).toBeUndefined()
  })

  it('should write the registry and the new node before remapping edges when splitting', async () => {
    const { manager, repo, callOrder } = createLiveGraph({
      nodes: [makeBareNode()],
      edges: [makeEdge({ id: 'e-split', fromId: 'bare-1', toId: 'place-1' })]
    })

    await splitGraphNode({
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

    expect(callOrder.indexOf('write:nodes:bare-1')).toBeGreaterThanOrEqual(0)
    expect(callOrder.indexOf(`write:nodes:${expectedSplitId}`)).toBeGreaterThan(
      callOrder.indexOf('write:nodes:bare-1')
    )
    expect(callOrder.indexOf('write:edges:e-split')).toBeGreaterThan(
      callOrder.indexOf(`write:nodes:${expectedSplitId}`)
    )
  })

  it('should skip rebuilding the split node and rewriting remapped edges when split is repeated', async () => {
    const graph = createLiveGraph({
      nodes: [makeBareNode()],
      edges: [
        makeEdge({ id: 'e-split', fromId: 'bare-1', toId: 'place-1' }),
        makeEdge({ id: 'e-keep', fromId: 'bare-1', toId: 'place-2', sourceRef: '2026-01-02' })
      ]
    })
    const input = {
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      label: '公司同事',
      edgeAssignments: [
        { edgeId: 'e-split', target: 'split' as const },
        { edgeId: 'e-keep', target: 'bare' as const }
      ],
      now: 100,
      manager: graph.manager as never,
      repo: graph.repo as never
    }

    await splitGraphNode(input)
    graph.manager.writeRecord.mockClear()
    graph.manager.removeRecordsFromShard.mockClear()

    const second = await splitGraphNode(input)

    expect(second.splitNodeId).toBe(expectedSplitId)
    expect(second.movedEdgeIds).toEqual([])
    expect(
      graph.manager.writeRecord.mock.calls.filter(
        (call) => call[1].collection === 'nodes' && call[0].id === expectedSplitId
      )
    ).toHaveLength(0)
    expect(
      graph.manager.writeRecord.mock.calls.filter((call) => call[1].collection === 'edges')
    ).toHaveLength(0)
  })

  it('should reuse the registered node id when the same discriminator is already recorded', async () => {
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
        })
      ],
      edges: []
    })

    const result = await splitGraphNode({
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

    expect(result.splitNodeId).toBe('already-split')
    expect(result.splitNodeId).not.toBe(expectedSplitId)
    expect(
      writes.some((item) => item.collection === 'nodes' && item.record.id === expectedSplitId)
    ).toBe(false)
  })

  it('should create the missing split node when the registry already points at it', async () => {
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
        })
      ],
      edges: []
    })

    await splitGraphNode({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      label: '公司同事',
      summary: '公司里的张三',
      edgeAssignments: [],
      now: 100,
      manager: manager as never,
      repo: repo as never
    })

    const rebuilt = writes.find(
      (item) => item.collection === 'nodes' && item.record.id === 'already-split'
    )
    expect(rebuilt?.record.name).toBe('张三')
    expect(rebuilt?.record.discriminator).toBe('同事')
    expect(rebuilt?.record.summary).toBe('公司里的张三')
    expect(rebuilt?.record.origin).toBe('user')
  })

  it('should keep the existing split node summary when the node is already present', async () => {
    const { manager, repo, writes, nodes } = createLiveGraph({
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
          propsJson: JSON.stringify({ splitReason: 'explicit-split' }),
          mentionCount: 3,
          firstSeenAt: 40,
          lastSeenAt: 50,
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
      summary: '',
      edgeAssignments: [],
      now: 999,
      manager: manager as never,
      repo: repo as never
    })

    expect(
      writes.some((item) => item.collection === 'nodes' && item.record.id === 'already-split')
    ).toBe(false)
    expect(nodes.get('already-split')?.summary).toBe('已有摘要')
    expect(nodes.get('already-split')?.mentionCount).toBe(3)
    expect(nodes.get('already-split')?.firstSeenAt).toBe(40)
    expect(nodes.get('already-split')?.createdAt).toBe(40)
  })
})
