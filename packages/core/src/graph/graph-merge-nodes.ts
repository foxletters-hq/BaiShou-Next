/**
 * Explicit diary-graph identity merge. File is source of truth; caller syncs after.
 * Does not change the default content-addressable id algorithm.
 */

import type { GraphEdgeRawRecord, GraphNodeRawRecord } from '@baishou/shared'
import { logger } from '@baishou/shared'

type MergeNode = {
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
}

type MergeEdge = {
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

export type GraphMergeRawWriter = {
  writeRecord(
    record: GraphNodeRawRecord | GraphEdgeRawRecord,
    opts: { collection: 'nodes' | 'edges' }
  ): Promise<unknown>
  removeRecordsFromShard(
    collection: 'nodes' | 'edges',
    shardMonth: string,
    ids: readonly string[]
  ): Promise<number>
}

export type GraphMergeLookup = {
  getNodeById(id: string, vaultId?: string): Promise<MergeNode | null>
  listEdgesTouching(vaultId: string, nodeId: string): Promise<MergeEdge[]>
}

function mergeAliases(existing: string[], incoming: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const a of [...existing, ...incoming]) {
    const t = a.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

function parseProps(raw?: string | null): Record<string, unknown> {
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

function asOrigin(value: string | undefined): 'ai' | 'user' {
  return value === 'user' ? 'user' : 'ai'
}

function asReview(value: string | undefined): 'approved' | 'pending' | 'rejected' {
  if (value === 'pending' || value === 'rejected') return value
  return 'approved'
}

function minSeen(a: number | null | undefined, b: number): number {
  if (a == null || !Number.isFinite(a)) return b
  return Math.min(a, b)
}

function maxSeen(a: number | null | undefined, b: number): number {
  if (a == null || !Number.isFinite(a)) return b
  return Math.max(a, b)
}

export async function mergeDiaryGraphNodes(input: {
  vaultId: string
  vaultName: string
  survivorId: string
  loserId: string
  reason?: string
  now?: number
  manager: GraphMergeRawWriter
  repo: GraphMergeLookup
}): Promise<{ survivorId: string; loserId: string }> {
  const survivorId = input.survivorId.trim()
  const loserId = input.loserId.trim()
  if (!survivorId || !loserId) throw new Error('mergeDiaryGraphNodes: ids required')
  if (survivorId === loserId) throw new Error('mergeDiaryGraphNodes: cannot merge a node into itself')

  const survivor = await input.repo.getNodeById(survivorId, input.vaultId)
  const loser = await input.repo.getNodeById(loserId, input.vaultId)
  if (!survivor || survivor.vaultId !== input.vaultId) {
    throw new Error('mergeDiaryGraphNodes: survivor not found')
  }
  if (!loser || loser.vaultId !== input.vaultId) {
    throw new Error('mergeDiaryGraphNodes: loser not found')
  }
  if (survivor.nodeType !== loser.nodeType) {
    throw new Error('只能合并同一类型的节点')
  }
  if (survivor.nodeType === 'entry' || loser.nodeType === 'entry') {
    throw new Error('日记锚点不能合并')
  }

  const now = input.now ?? Date.now()
  const reason = input.reason?.trim() || 'explicit-merge'
  const survivorProps = parseProps(survivor.propsJson)
  const history = Array.isArray(survivorProps.mergeHistory) ? [...survivorProps.mergeHistory] : []
  history.push({ loserId, name: loser.name, reason, at: now })

  const survivorRecord: GraphNodeRawRecord = {
    id: survivor.id,
    schemaVersion: 1,
    vaultId: input.vaultId,
    vaultName: input.vaultName,
    nodeType: survivor.nodeType,
    name: survivor.name,
    aliases: mergeAliases(survivor.aliases ?? [], [loser.name, ...(loser.aliases ?? [])]),
    summary: survivor.summary || loser.summary || '',
    props: { ...survivorProps, mergeHistory: history },
    mentionCount: (survivor.mentionCount ?? 0) + (loser.mentionCount ?? 0),
    firstSeenAt: minSeen(survivor.firstSeenAt, loser.firstSeenAt ?? now),
    lastSeenAt: maxSeen(survivor.lastSeenAt, loser.lastSeenAt ?? now),
    origin: asOrigin(survivor.origin),
    shardMonth: survivor.shardMonth,
    createdAt: survivor.createdAt,
    updatedAt: now,
    deletedAt: null,
    reviewStatus: asReview(survivor.reviewStatus)
  }
  if (!survivorRecord.shardMonth) {
    throw new Error('mergeDiaryGraphNodes: survivor missing shardMonth')
  }
  await input.manager.writeRecord(survivorRecord, { collection: 'nodes' })

  const edges = await input.repo.listEdgesTouching(input.vaultId, loserId)
  for (const edge of edges) {
    const shardMonth = edge.shardMonth || survivor.shardMonth
    if (!shardMonth) {
      logger.warn('[graph] merge skip edge without shardMonth', { edgeId: edge.id })
      continue
    }
    const fromId = edge.fromId === loserId ? survivorId : edge.fromId
    const toId = edge.toId === loserId ? survivorId : edge.toId
    if (fromId === toId) {
      await input.manager.removeRecordsFromShard('edges', shardMonth, [edge.id])
      continue
    }
    const base: GraphEdgeRawRecord = {
      id: edge.id,
      schemaVersion: 1,
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      fromId,
      toId,
      edgeType: edge.edgeType,
      props: parseProps(edge.propsJson),
      validFrom: edge.validFrom,
      validTo: edge.validTo,
      isCurrent: edge.isCurrent,
      sourceKind: edge.sourceKind,
      sourceRef: edge.sourceRef,
      sourceExcerpt: edge.sourceExcerpt,
      sourceContentHash: edge.sourceContentHash,
      confidence: edge.confidence,
      origin: asOrigin(edge.origin),
      reviewStatus: asReview(edge.reviewStatus),
      shardMonth,
      createdAt: edge.createdAt,
      updatedAt: now,
      deletedAt: null
    }
    await input.manager.writeRecord(base, { collection: 'edges' })
  }

  if (!loser.shardMonth) {
    throw new Error('mergeDiaryGraphNodes: loser missing shardMonth')
  }
  await input.manager.removeRecordsFromShard('nodes', loser.shardMonth, [loser.id])

  return { survivorId, loserId }
}

/** Apply pending file rows, then drop the loser in SQLite. Do not skip the soft-delete. */
export async function syncDiaryGraphMergeIntoIndex(input: {
  loserId: string
  syncPendingIndex: (opts?: { absentSweep?: 'off' }) => Promise<unknown>
  softDeleteNode: (id: string) => Promise<void>
}): Promise<void> {
  await input.syncPendingIndex({ absentSweep: 'off' })
  await input.softDeleteNode(input.loserId)
}

export async function mergeDiaryGraphNodeGroup(input: {
  vaultId: string
  vaultName: string
  survivorId: string
  loserIds: string[]
  reason?: string
  now?: number
  manager: GraphMergeRawWriter
  repo: GraphMergeLookup
}): Promise<{ survivorId: string; loserIds: string[] }> {
  const survivorId = input.survivorId.trim()
  const loserIds = [...new Set(input.loserIds.map((id) => id.trim()).filter(Boolean))]
  if (!survivorId) throw new Error('mergeDiaryGraphNodeGroup: survivor required')
  if (loserIds.length === 0) throw new Error('mergeDiaryGraphNodeGroup: loserIds required')
  if (loserIds.includes(survivorId)) {
    throw new Error('mergeDiaryGraphNodeGroup: cannot merge a node into itself')
  }
  for (const loserId of loserIds) {
    await mergeDiaryGraphNodes({
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      survivorId,
      loserId,
      reason: input.reason,
      now: input.now,
      manager: input.manager,
      repo: input.repo
    })
  }
  return { survivorId, loserIds }
}

export async function syncDiaryGraphMergeGroupIntoIndex(input: {
  loserIds: string[]
  syncPendingIndex: (opts?: { absentSweep?: 'off' }) => Promise<unknown>
  softDeleteNode: (id: string) => Promise<void>
}): Promise<void> {
  await input.syncPendingIndex({ absentSweep: 'off' })
  for (const loserId of input.loserIds) {
    await input.softDeleteNode(loserId)
  }
}
