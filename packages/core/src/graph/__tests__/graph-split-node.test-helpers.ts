import { vi } from 'vitest'
import { graphNodeIdForEntity } from '@baishou/shared'

export type LookupNode = {
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

export type LookupEdge = {
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

export type WriteCall = {
  collection: string
  record: Record<string, unknown>
}

export function makeBareNode(overrides: Partial<LookupNode> = {}): LookupNode {
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

export function makeEdge(
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

export function rawNodeToLookup(record: Record<string, unknown>): LookupNode {
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

export function rawEdgeToLookup(record: Record<string, unknown>): LookupEdge {
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

export function createLiveGraph(seed: { nodes: LookupNode[]; edges?: LookupEdge[] }) {
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

export function emptyManager() {
  return {
    writeRecord: vi.fn(),
    removeRecordsFromShard: vi.fn()
  }
}

export const expectedSplitId = graphNodeIdForEntity('v1', 'person', '张三', '同事')
