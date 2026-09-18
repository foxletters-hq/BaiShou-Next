import { afterEach, describe, expect, it, vi } from 'vitest'
import { graphNodeIdForEntity } from '@baishou/shared'
import * as mergeNodes from '../graph-merge-nodes'
import { revertGraphNodeSplit, splitGraphNode } from '../graph-split-node'

type LookupNode = {
  id: string
  vaultId: string
  nodeType: string
  name: string
  aliases: string[]
  summary: string
  propsJson?: string
  mentionCount: number
  firstSeenAt: number | null
  lastSeenAt: number | null
  origin: string
  shardMonth: string
  reviewStatus?: string
  createdAt: number
  discriminator?: string
}

type LookupEdge = {
  id: string
  vaultId: string
  fromId: string
  toId: string
  edgeType: string
  propsJson?: string
  validFrom: number | null
  validTo: number | null
  isCurrent: boolean
  sourceKind: string
  sourceRef: string | null
  sourceExcerpt: string
  sourceContentHash: string | null
  confidence: number
  origin: string
  reviewStatus: string
  shardMonth: string
  createdAt: number
}

type WriteCall = {
  collection: string
  record: Record<string, unknown>
}

function makeBareNode(overrides: Partial<LookupNode> = {}): LookupNode {
  return {
    id: 'bare-1',
    vaultId: 'v1',
    nodeType: 'person',
    name: '张三',
    aliases: ['张三'],
    summary: '初中同学',
    propsJson: '{}',
    mentionCount: 2,
    firstSeenAt: 10,
    lastSeenAt: 20,
    origin: 'ai',
    shardMonth: '2026-01',
    reviewStatus: 'approved',
    createdAt: 10,
    ...overrides
  }
}

function makeEdge(
  overrides: Partial<LookupEdge> & Pick<LookupEdge, 'id' | 'fromId' | 'toId'>
): LookupEdge {
  return {
    vaultId: 'v1',
    edgeType: 'knows',
    propsJson: '{}',
    validFrom: 10,
    validTo: null,
    isCurrent: true,
    sourceKind: 'diary',
    sourceRef: '2026-01-01',
    sourceExcerpt: '',
    sourceContentHash: null,
    confidence: 80,
    origin: 'ai',
    reviewStatus: 'pending',
    shardMonth: '2026-01',
    createdAt: 10,
    ...overrides
  }
}

function rawNodeToLookup(record: Record<string, unknown>): LookupNode {
  return {
    id: String(record.id),
    vaultId: String(record.vaultId),
    nodeType: String(record.nodeType),
    name: String(record.name),
    aliases: Array.isArray(record.aliases) ? (record.aliases as string[]) : [],
    summary: String(record.summary ?? ''),
    propsJson: JSON.stringify(record.props ?? {}),
    mentionCount: Number(record.mentionCount ?? 0),
    firstSeenAt: typeof record.firstSeenAt === 'number' ? record.firstSeenAt : null,
    lastSeenAt: typeof record.lastSeenAt === 'number' ? record.lastSeenAt : null,
    origin: String(record.origin ?? 'ai'),
    shardMonth: String(record.shardMonth ?? ''),
    reviewStatus: typeof record.reviewStatus === 'string' ? record.reviewStatus : undefined,
    createdAt: Number(record.createdAt ?? 0),
    discriminator: typeof record.discriminator === 'string' ? record.discriminator : undefined
  }
}

function rawEdgeToLookup(record: Record<string, unknown>): LookupEdge {
  return {
    id: String(record.id),
    vaultId: String(record.vaultId),
    fromId: String(record.fromId),
    toId: String(record.toId),
    edgeType: String(record.edgeType),
    propsJson: JSON.stringify(record.props ?? {}),
    validFrom: typeof record.validFrom === 'number' ? record.validFrom : null,
    validTo: typeof record.validTo === 'number' ? record.validTo : null,
    isCurrent: Boolean(record.isCurrent),
    sourceKind: String(record.sourceKind ?? ''),
    sourceRef: typeof record.sourceRef === 'string' ? record.sourceRef : null,
    sourceExcerpt: String(record.sourceExcerpt ?? ''),
    sourceContentHash:
      typeof record.sourceContentHash === 'string' ? record.sourceContentHash : null,
    confidence: Number(record.confidence ?? 0),
    origin: String(record.origin ?? 'ai'),
    reviewStatus: String(record.reviewStatus ?? 'approved'),
    shardMonth: String(record.shardMonth ?? ''),
    createdAt: Number(record.createdAt ?? 0)
  }
}

function createLiveGraph(seed: { nodes: LookupNode[]; edges?: LookupEdge[] }) {
  const nodes = new Map(seed.nodes.map((node) => [node.id, { ...node }]))
  const edges = new Map((seed.edges ?? []).map((edge) => [edge.id, { ...edge }]))
  const writes: WriteCall[] = []
  const callOrder: string[] = []
  const removed: Array<{ collection: string; shardMonth: string; ids: readonly string[] }> = []

  const manager = {
    writeRecord: vi.fn(async (record: Record<string, unknown>, opts: { collection: string }) => {
      writes.push({ collection: opts.collection, record })
      callOrder.push(`write:${opts.collection}:${String(record.id)}`)
      if (opts.collection === 'nodes') {
        nodes.set(String(record.id), rawNodeToLookup(record))
      } else {
        edges.set(String(record.id), rawEdgeToLookup(record))
      }
    }),
    removeRecordsFromShard: vi.fn(
      async (collection: 'nodes' | 'edges', shardMonth: string, ids: readonly string[]) => {
        removed.push({ collection, shardMonth, ids })
        callOrder.push(`remove:${collection}:${ids.join(',')}`)
        for (const id of ids) {
          if (collection === 'nodes') nodes.delete(id)
          else edges.delete(id)
        }
        return ids.length
      }
    )
  }

  const repo = {
    getNodeById: vi.fn(async (id: string) => nodes.get(id) ?? null),
    listEdgesTouching: vi.fn(async (_vaultId: string, nodeId: string) =>
      [...edges.values()].filter((edge) => edge.fromId === nodeId || edge.toId === nodeId)
    )
  }

  return { manager, repo, writes, callOrder, removed, nodes, edges }
}

function emptyManager() {
  return {
    writeRecord: vi.fn(),
    removeRecordsFromShard: vi.fn()
  }
}

const expectedSplitId = graphNodeIdForEntity('v1', 'person', '张三', '同事')

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

describe('revertGraphNodeSplit', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should call merge and remove the registry from post-merge props when reverting', async () => {
    const mergeSpy = vi.spyOn(mergeNodes, 'mergeDiaryGraphNodes')
    const splitId = expectedSplitId
    const { manager, repo, writes } = createLiveGraph({
      nodes: [
        makeBareNode({
          propsJson: JSON.stringify({
            keepMe: 'must-survive-merge',
            nameRegistry: [
              {
                discriminator: '同事',
                label: '公司同事',
                nodeId: splitId,
                registeredAt: 50
              }
            ]
          })
        }),
        {
          id: splitId,
          vaultId: 'v1',
          nodeType: 'person',
          name: '张三',
          aliases: ['张三'],
          summary: '公司里的张三',
          propsJson: '{}',
          mentionCount: 0,
          firstSeenAt: 100,
          lastSeenAt: 100,
          origin: 'user',
          shardMonth: '2026-01',
          reviewStatus: 'approved',
          createdAt: 100,
          discriminator: '同事'
        }
      ],
      edges: [makeEdge({ id: 'e-moved', fromId: splitId, toId: 'place-1' })]
    })

    const result = await revertGraphNodeSplit({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      reason: 'undo-split',
      now: 200,
      manager: manager as never,
      repo: repo as never
    })

    expect(result).toEqual({ removedNodeId: splitId })
    expect(mergeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        survivorId: 'bare-1',
        loserId: splitId,
        reason: 'undo-split',
        now: 200
      })
    )

    const lastBareWrite = [...writes]
      .reverse()
      .find((item) => item.collection === 'nodes' && item.record.id === 'bare-1')
    const props = lastBareWrite?.record.props as Record<string, unknown> | undefined
    expect(props?.nameRegistry).toBeUndefined()
    expect(props?.keepMe).toBe('must-survive-merge')
    expect(Array.isArray(props?.mergeHistory)).toBe(true)
    expect(props?.mergeHistory).toEqual(
      expect.arrayContaining([expect.objectContaining({ loserId: splitId, reason: 'undo-split' })])
    )

    mergeSpy.mockRestore()
  })

  it('should remove the registry without merging when the split node is already gone', async () => {
    const mergeSpy = vi.spyOn(mergeNodes, 'mergeDiaryGraphNodes')
    const { manager, repo, writes } = createLiveGraph({
      nodes: [
        makeBareNode({
          propsJson: JSON.stringify({
            keepMe: 'must-survive-clear',
            nameRegistry: [
              {
                discriminator: '同事',
                label: '公司同事',
                nodeId: expectedSplitId,
                registeredAt: 50
              }
            ]
          })
        })
      ],
      edges: []
    })

    const result = await revertGraphNodeSplit({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      now: 200,
      manager: manager as never,
      repo: repo as never
    })

    expect(result).toEqual({ removedNodeId: null })
    expect(mergeSpy).not.toHaveBeenCalled()
    const lastBareWrite = [...writes]
      .reverse()
      .find((item) => item.collection === 'nodes' && item.record.id === 'bare-1')
    const props = lastBareWrite?.record.props as Record<string, unknown> | undefined
    expect(props?.nameRegistry).toBeUndefined()
    expect(props?.keepMe).toBe('must-survive-clear')
    mergeSpy.mockRestore()
  })

  it('should pass revert-split to merge when revert reason is omitted', async () => {
    const mergeSpy = vi.spyOn(mergeNodes, 'mergeDiaryGraphNodes')
    const splitId = expectedSplitId
    const { manager, repo } = createLiveGraph({
      nodes: [
        makeBareNode({
          propsJson: JSON.stringify({
            nameRegistry: [
              {
                discriminator: '同事',
                label: '公司同事',
                nodeId: splitId,
                registeredAt: 50
              }
            ]
          })
        }),
        {
          id: splitId,
          vaultId: 'v1',
          nodeType: 'person',
          name: '张三',
          aliases: ['张三'],
          summary: '',
          propsJson: '{}',
          mentionCount: 0,
          firstSeenAt: 100,
          lastSeenAt: 100,
          origin: 'user',
          shardMonth: '2026-01',
          reviewStatus: 'approved',
          createdAt: 100,
          discriminator: '同事'
        }
      ],
      edges: []
    })

    await revertGraphNodeSplit({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      now: 200,
      manager: manager as never,
      repo: repo as never
    })

    expect(mergeSpy).toHaveBeenCalledWith(expect.objectContaining({ reason: 'revert-split' }))
    mergeSpy.mockRestore()
  })

  it('should return null when the discriminator is not registered', async () => {
    const mergeSpy = vi.spyOn(mergeNodes, 'mergeDiaryGraphNodes')
    const { manager, repo } = createLiveGraph({
      nodes: [makeBareNode({ propsJson: '{}' })],
      edges: []
    })

    const result = await revertGraphNodeSplit({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      manager: manager as never,
      repo: repo as never
    })

    expect(result).toEqual({ removedNodeId: null })
    expect(mergeSpy).not.toHaveBeenCalled()
    mergeSpy.mockRestore()
  })
})
