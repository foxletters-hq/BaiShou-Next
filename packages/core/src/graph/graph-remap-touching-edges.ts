/**
 * 拆分与合并共用的改挂：换端点、删自环、保留原边 id。
 * 拆分多出来的「只改已分配边、支持重入」用 shouldRemap / 已离开判断表达。
 */
import type { GraphEdgeRawRecord } from '@baishou/shared'
import { logger } from '@baishou/shared'

export type RemapTouchingEdgeInput = {
  id: string
  fromId: string
  toId: string
  edgeType: string
  propsJson?: string | null
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

export type RemapTouchingEdgesWriter = {
  writeRecord(record: GraphEdgeRawRecord, opts: { collection: 'edges' }): Promise<unknown>
  removeRecordsFromShard(
    collection: 'edges',
    shardMonth: string,
    ids: readonly string[]
  ): Promise<number>
}

export function parseGraphPropsJson(raw?: string | null): Record<string, unknown> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function asGraphOrigin(value: string | undefined): 'ai' | 'user' {
  return value === 'user' ? 'user' : 'ai'
}

export function asGraphReview(value: string | undefined): 'approved' | 'pending' | 'rejected' {
  if (value === 'pending' || value === 'rejected') return value
  return 'approved'
}

export async function remapTouchingEdges(input: {
  vaultId: string
  vaultName: string
  fromNodeId: string
  toNodeId: string
  edges: RemapTouchingEdgeInput[]
  now: number
  fallbackShardMonth: string
  manager: RemapTouchingEdgesWriter
  shouldRemap?: (edge: RemapTouchingEdgeInput) => boolean
}): Promise<{ movedEdgeIds: string[] }> {
  const movedEdgeIds: string[] = []
  for (const edge of input.edges) {
    if (input.shouldRemap && !input.shouldRemap(edge)) continue
    // 已经不再碰原节点，说明上一次已经改挂过，重入时不能再写一遍
    if (edge.fromId !== input.fromNodeId && edge.toId !== input.fromNodeId) continue

    const shardMonth = edge.shardMonth || input.fallbackShardMonth
    if (!shardMonth) {
      logger.warn('[graph] remap skip edge without shardMonth', { edgeId: edge.id })
      continue
    }
    const fromId = edge.fromId === input.fromNodeId ? input.toNodeId : edge.fromId
    const toId = edge.toId === input.fromNodeId ? input.toNodeId : edge.toId
    if (fromId === toId) {
      await input.manager.removeRecordsFromShard('edges', shardMonth, [edge.id])
      movedEdgeIds.push(edge.id)
      continue
    }
    const remapped: GraphEdgeRawRecord = {
      id: edge.id,
      schemaVersion: 1,
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      fromId,
      toId,
      edgeType: edge.edgeType,
      props: parseGraphPropsJson(edge.propsJson),
      validFrom: edge.validFrom,
      validTo: edge.validTo,
      isCurrent: edge.isCurrent,
      sourceKind: edge.sourceKind,
      sourceRef: edge.sourceRef,
      sourceExcerpt: edge.sourceExcerpt,
      sourceContentHash: edge.sourceContentHash,
      confidence: edge.confidence,
      origin: asGraphOrigin(edge.origin),
      reviewStatus: asGraphReview(edge.reviewStatus),
      shardMonth,
      createdAt: edge.createdAt,
      updatedAt: input.now,
      deletedAt: null
    }
    await input.manager.writeRecord(remapped, { collection: 'edges' })
    movedEdgeIds.push(edge.id)
  }
  return { movedEdgeIds }
}
