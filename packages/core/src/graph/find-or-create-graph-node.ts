/**
 * Shared find-or-create for graph entity nodes (diary extract + graph_upsert tool).
 * Uses stable content ids; does not invent random UUIDs for entities.
 */

import {
  entryNodeIdForFilePath,
  graphNodeIdForEntity,
  logger,
  normalizeGraphName,
  preferGraphOrigin,
  type GraphNodeRawRecord
} from '@baishou/shared'
import type { GraphNodeLookup } from '@baishou/database/shared'

export type FindOrCreateGraphNodeInput = {
  vaultId: string
  vaultName: string
  nodeType: string
  name: string
  aliases?: string[]
  summary?: string
  shardMonth: string
  origin?: 'ai' | 'user'
  reviewStatus?: 'approved' | 'pending' | 'rejected'
  now?: number
  /** Diary calendar instant for first/last seen. Falls back to `now`. */
  seenAt?: number
  /** Reuse a previously aligned id instead of looking up by name. */
  forceId?: string
  /** Diary entry anchor — use filePath instead of name-based id. */
  entryFilePath?: string
}

export type FindOrCreateGraphNodeResult = {
  id: string
  record: GraphNodeRawRecord
  reused: boolean
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

/**
 * Resolve an existing node by name/alias (and type), or build a stable-id record.
 * Caller is responsible for writing the record to GraphRawManager.
 */
export async function findOrCreateGraphNode(
  repo: GraphNodeLookup,
  input: FindOrCreateGraphNodeInput
): Promise<FindOrCreateGraphNodeResult> {
  const now = input.now ?? Date.now()
  const seenAt = input.seenAt ?? now
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (!name) {
    throw new Error('findOrCreateGraphNode: empty name')
  }

  const nodeType = input.nodeType.trim().toLowerCase() || 'topic'
  if (nodeType === 'entry') {
    const filePath = input.entryFilePath?.trim()
    if (!filePath) {
      throw new Error('findOrCreateGraphNode: entry requires entryFilePath')
    }
    const id = entryNodeIdForFilePath(filePath, input.vaultId)
    const existing = await repo.getNodeById(id, input.vaultId)
    const record: GraphNodeRawRecord = {
      id,
      schemaVersion: 1,
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      nodeType: 'entry',
      name,
      aliases: mergeAliases(existing?.aliases ?? [], input.aliases ?? []),
      summary: input.summary ?? existing?.summary ?? '',
      props: existing ? safeProps(existing.propsJson) : { filePath },
      mentionCount: existing ? existing.mentionCount : 0,
      firstSeenAt: minSeen(existing?.firstSeenAt, seenAt),
      lastSeenAt: maxSeen(existing?.lastSeenAt, seenAt),
      origin: preferGraphOrigin(existing?.origin, input.origin),
      shardMonth: input.shardMonth || existing?.shardMonth || '',
      createdAt: existing?.createdAt ?? seenAt,
      updatedAt: now,
      deletedAt: null,
      reviewStatus: preferReviewStatus(existing?.reviewStatus, input.reviewStatus)
    }
    return { id, record, reused: !!existing }
  }

  if (input.forceId) {
    const existing = await repo.getNodeById(input.forceId, input.vaultId)
    const incomingAliases = input.aliases ?? []
    const record: GraphNodeRawRecord = {
      id: input.forceId,
      schemaVersion: 1,
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      nodeType,
      name: existing?.name ?? name,
      aliases: mergeAliases(existing?.aliases ?? [], [name, ...incomingAliases]),
      summary: input.summary ?? existing?.summary ?? '',
      props: existing ? safeProps(existing.propsJson) : {},
      mentionCount: existing ? existing.mentionCount : 0,
      firstSeenAt: minSeen(existing?.firstSeenAt, seenAt),
      lastSeenAt: maxSeen(existing?.lastSeenAt, seenAt),
      origin: preferGraphOrigin(existing?.origin, input.origin),
      shardMonth: existing?.shardMonth || input.shardMonth,
      createdAt: existing?.createdAt ?? seenAt,
      updatedAt: now,
      deletedAt: null,
      reviewStatus: preferReviewStatus(existing?.reviewStatus, input.reviewStatus)
    }
    return { id: input.forceId, record, reused: !!existing }
  }

  const existing = await repo.findNodeByNameOrAlias(input.vaultId, name, nodeType)
  const id = existing?.id ?? graphNodeIdForEntity(input.vaultId, nodeType, name)
  const incomingAliases = input.aliases ?? []
  const record: GraphNodeRawRecord = {
    id,
    schemaVersion: 1,
    vaultId: input.vaultId,
    vaultName: input.vaultName,
    nodeType,
    name: existing?.name ?? name,
    aliases: mergeAliases(existing?.aliases ?? [], [name, ...incomingAliases]),
    summary: input.summary ?? existing?.summary ?? '',
    props: existing ? safeProps(existing.propsJson) : {},
    mentionCount: existing ? existing.mentionCount : 0,
    firstSeenAt: minSeen(existing?.firstSeenAt, seenAt),
    lastSeenAt: maxSeen(existing?.lastSeenAt, seenAt),
    origin: preferGraphOrigin(existing?.origin, input.origin),
    shardMonth: existing?.shardMonth || input.shardMonth,
    createdAt: existing?.createdAt ?? seenAt,
    updatedAt: now,
    deletedAt: null,
    reviewStatus: preferReviewStatus(existing?.reviewStatus, input.reviewStatus)
  }
  return { id, record, reused: !!existing }
}

/** Resolve endpoint name to node id within a batch map, then SQLite. */
export async function resolveGraphEndpointId(
  repo: GraphNodeLookup,
  vaultId: string,
  rawName: string,
  nameToId: Map<string, string>,
  opts?: { nodeType?: string; role?: string; sourceRef?: string }
): Promise<string | null> {
  const trimmed = rawName.trim()
  const key = normalizeGraphName(trimmed)
  if (!key) return null
  const mapped = nameToId.get(key)
  if (mapped) return mapped
  const exact = await repo.findNodeByNameOrAlias(vaultId, trimmed, opts?.nodeType)
  if (exact) {
    nameToId.set(key, exact.id)
    return exact.id
  }
  logger.warn('[graph] unresolved endpoint', {
    role: opts?.role ?? 'endpoint',
    name: trimmed,
    nodeType: opts?.nodeType ?? '',
    sourceRef: opts?.sourceRef ?? ''
  })
  return null
}

function preferReviewStatus(
  existing: string | null | undefined,
  incoming?: 'approved' | 'pending' | 'rejected'
): 'approved' | 'pending' | 'rejected' {
  if (existing === 'approved') return 'approved'
  if (incoming) return incoming
  if (existing === 'pending' || existing === 'rejected') return existing
  return 'approved'
}

function minSeen(existing: number | null | undefined, seenAt: number): number {
  if (existing == null || !Number.isFinite(existing)) return seenAt
  return Math.min(existing, seenAt)
}

function maxSeen(existing: number | null | undefined, seenAt: number): number {
  if (existing == null || !Number.isFinite(existing)) return seenAt
  return Math.max(existing, seenAt)
}

function safeProps(propsJson: string): Record<string, unknown> {
  try {
    return JSON.parse(propsJson || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}
