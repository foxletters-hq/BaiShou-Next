import type { GraphExtractStore } from '@baishou/database/shared'
import {
  appendAmbiguousSourceRef,
  applyAlignedSimilarPendingToProps,
  entityAlignKey,
  graphEdgeId,
  graphReviewStatusFromConfidence,
  legacyEntryNodeIdForFilePath,
  normalizeGraphName,
  preferGraphOrigin
} from '@baishou/shared'
import type { GraphEdgeRawRecord, GraphNodeRawRecord } from '../raw-data/raw-data-source.types'
import type { GraphExtractRawWriter } from '../raw-data/graph-extract-raw'
import {
  findOrCreateGraphNode,
  resolveGraphEndpointId,
  type ResolveGraphEndpointResult
} from './find-or-create-graph-node'
import { alignedEmbeddingForNodeCard, type AlignedEntity } from './graph-entity-align'
import type { GraphExtractDraft } from './graph-llm-extraction.types'
import { parseJsonObject } from './graph-llm-extraction.prompt'

export type GraphExtractPersistCtx = {
  repo: GraphExtractStore
  graphManager: GraphExtractRawWriter
}

export function bindEndpointName(
  nameToId: Map<string, ResolveGraphEndpointResult>,
  name: string,
  id: string,
  ambiguous: boolean
): void {
  const key = normalizeGraphName(name)
  if (!key) return
  nameToId.set(key, { id, ambiguous })
}

export function reviewStatusForAmbiguousEndpoint(
  status: 'approved' | 'pending' | 'rejected',
  ambiguous: boolean
): 'approved' | 'pending' | 'rejected' {
  if (!ambiguous) return status
  // 已驳回比待确认更严，多候选不能把它放宽
  if (status === 'rejected') return 'rejected'
  return 'pending'
}

export function graphNodeRowToRawRecord(
  row: {
    id: string
    nodeType: string
    name: string
    discriminator?: string | null
    aliases: string[]
    summary: string
    propsJson: string
    mentionCount: number
    firstSeenAt: number | null
    lastSeenAt: number | null
    origin: string
    shardMonth: string
    createdAt: number
    deletedAt: number | null
    reviewStatus: string
  },
  vaultId: string,
  vaultName: string,
  updatedAt: number
): GraphNodeRawRecord {
  let props: Record<string, unknown> = {}
  try {
    props = JSON.parse(row.propsJson || '{}') as Record<string, unknown>
  } catch {
    props = {}
  }
  return {
    id: row.id,
    schemaVersion: 1,
    vaultId,
    vaultName,
    nodeType: row.nodeType,
    name: row.name,
    discriminator: row.discriminator ?? undefined,
    aliases: row.aliases,
    summary: row.summary,
    props,
    mentionCount: row.mentionCount,
    firstSeenAt: row.firstSeenAt ?? updatedAt,
    lastSeenAt: row.lastSeenAt ?? updatedAt,
    origin: preferGraphOrigin(row.origin),
    shardMonth: row.shardMonth,
    createdAt: row.createdAt,
    updatedAt,
    deletedAt: row.deletedAt,
    reviewStatus:
      row.reviewStatus === 'pending' || row.reviewStatus === 'rejected'
        ? row.reviewStatus
        : 'approved'
  }
}

export async function appendAmbiguousSourceRefsToBareNodes(
  ctx: GraphExtractPersistCtx,
  input: {
    vaultId: string
    vaultName: string
    sourceRef: string
    now: number
    ambiguousNodeIds: Set<string>
    nodeRecords: GraphNodeRawRecord[]
  }
): Promise<void> {
  const written = new Map(input.nodeRecords.map((record) => [record.id, record]))
  for (const id of input.ambiguousNodeIds) {
    const existing = written.get(id)
    if (existing) {
      existing.props = appendAmbiguousSourceRef(existing.props, input.sourceRef)
      existing.updatedAt = input.now
      continue
    }
    const row = await ctx.repo.getNodeById(id, input.vaultId)
    if (!row) continue
    const record = graphNodeRowToRawRecord(row, input.vaultId, input.vaultName, input.now)
    record.props = appendAmbiguousSourceRef(record.props, input.sourceRef)
    input.nodeRecords.push(record)
    written.set(id, record)
  }
}

export async function writeMentionCountsToJsonl(
  ctx: GraphExtractPersistCtx,
  vaultId: string,
  vaultName: string,
  nodeIds: string[]
): Promise<void> {
  for (const id of nodeIds) {
    const row = await ctx.repo.getNodeById(id, vaultId)
    if (!row) continue
    const writtenAt = Math.max(Date.now(), row.updatedAt ?? 0) + 1
    const record = graphNodeRowToRawRecord(row, vaultId, vaultName, writtenAt)
    await ctx.graphManager.writeRecord(record, { collection: 'nodes' })
  }
}

export async function persistGraphExtractDraft(
  ctx: GraphExtractPersistCtx,
  draft: GraphExtractDraft,
  aligned: Map<string, AlignedEntity>,
  now: number
): Promise<{
  nodeIds: string[]
  embeddings: Array<{ id: string; embedding: number[]; text: string }>
}> {
  const { vaultId, vaultName, filePath, hash, dateStr, shardMonth, validFrom } = draft
  const sourceRef = dateStr || filePath
  const nameToId = new Map<string, ResolveGraphEndpointResult>()
  const nodeRecords: GraphNodeRawRecord[] = []
  const edgeRecords: GraphEdgeRawRecord[] = []
  const touchedNodeIds: string[] = []
  const alignedEmbeddings: Array<{ id: string; embedding: number[]; text: string }> = []
  const ambiguousNodeIds = new Set<string>()

  const entryName = dateStr || '日记'
  const legacyEntryId = legacyEntryNodeIdForFilePath(filePath)
  const entryCreated = await findOrCreateGraphNode(ctx.repo, {
    vaultId,
    vaultName,
    nodeType: 'entry',
    name: entryName,
    aliases: dateStr ? [dateStr] : [],
    shardMonth,
    entryFilePath: filePath,
    origin: 'ai',
    reviewStatus: 'approved',
    now,
    seenAt: validFrom
  })
  nodeRecords.push(entryCreated.record)
  touchedNodeIds.push(entryCreated.id)
  bindEndpointName(nameToId, entryName, entryCreated.id, false)
  if (dateStr) bindEndpointName(nameToId, dateStr, entryCreated.id, false)
  bindEndpointName(nameToId, 'entry', entryCreated.id, false)

  for (const ent of draft.entities) {
    const hit = aligned.get(entityAlignKey(ent.type, ent.name))
    const created = await findOrCreateGraphNode(ctx.repo, {
      vaultId,
      vaultName,
      nodeType: ent.type,
      name: hit?.canonicalName || ent.name,
      aliases: hit?.aliases ?? ent.aliases,
      summary: hit?.summary || ent.summary,
      shardMonth,
      origin: 'ai',
      reviewStatus: graphReviewStatusFromConfidence(ent.confidence),
      now,
      seenAt: validFrom,
      forceId: hit?.id
    })
    const ambiguous = hit?.ambiguous === true || created.ambiguous
    if (ambiguous) {
      // 边先挂裸名，出处进复核清单，避免同名不同人被静默写死
      created.record.props = appendAmbiguousSourceRef(created.record.props, sourceRef)
      ambiguousNodeIds.add(created.id)
    }
    created.record.props = applyAlignedSimilarPendingToProps(created.record.props, hit)
    nodeRecords.push(created.record)
    touchedNodeIds.push(created.id)
    bindEndpointName(nameToId, ent.name, created.id, ambiguous)
    if (hit?.canonicalName) bindEndpointName(nameToId, hit.canonicalName, created.id, ambiguous)
    const reusable = alignedEmbeddingForNodeCard(hit, created.record.name, created.record.summary)
    if (reusable) alignedEmbeddings.push({ id: created.id, ...reusable })
  }

  const typeByName = new Map<string, string>()
  for (const ent of draft.entities) {
    const key = normalizeGraphName(ent.name)
    if (key) typeByName.set(key, ent.type)
  }
  for (const edge of draft.edges) {
    const from = await resolveGraphEndpointId(ctx.repo, vaultId, edge.from, nameToId, {
      nodeType: typeByName.get(normalizeGraphName(edge.from)),
      role: 'from',
      sourceRef
    })
    const to = await resolveGraphEndpointId(ctx.repo, vaultId, edge.to, nameToId, {
      nodeType: typeByName.get(normalizeGraphName(edge.to)),
      role: 'to',
      sourceRef
    })
    if (!from || !to) continue
    if (from.ambiguous) ambiguousNodeIds.add(from.id)
    if (to.ambiguous) ambiguousNodeIds.add(to.id)
    const reviewStatus = reviewStatusForAmbiguousEndpoint(
      graphReviewStatusFromConfidence(edge.confidence),
      from.ambiguous || to.ambiguous
    )
    edgeRecords.push({
      id: graphEdgeId(vaultId, from.id, to.id, edge.type, sourceRef),
      schemaVersion: 1,
      vaultId,
      vaultName,
      fromId: from.id,
      toId: to.id,
      edgeType: edge.type,
      props: {},
      validFrom,
      validTo: null,
      isCurrent: true,
      sourceKind: 'diary',
      sourceRef,
      sourceExcerpt: edge.excerpt,
      sourceContentHash: hash,
      confidence: edge.confidence,
      origin: 'ai',
      reviewStatus,
      shardMonth,
      createdAt: validFrom,
      updatedAt: now,
      deletedAt: null
    })
    touchedNodeIds.push(from.id, to.id)
  }

  await appendAmbiguousSourceRefsToBareNodes(ctx, {
    vaultId,
    vaultName,
    sourceRef,
    now,
    ambiguousNodeIds,
    nodeRecords
  })

  for (const record of nodeRecords) {
    await ctx.graphManager.writeRecord(record, { collection: 'nodes' })
  }
  const existingLegacy = await ctx.repo.getNodeById(legacyEntryId, vaultId)
  if (existingLegacy && legacyEntryId !== entryCreated.id) {
    const listEdges = ctx.repo.listEdgesTouching
    if (typeof listEdges === 'function') {
      const touching = await listEdges.call(ctx.repo, vaultId, legacyEntryId)
      for (const edge of touching) {
        const month = edge.shardMonth || shardMonth
        if (!month) continue
        const fromId = edge.fromId === legacyEntryId ? entryCreated.id : edge.fromId
        const toId = edge.toId === legacyEntryId ? entryCreated.id : edge.toId
        if (fromId === toId) {
          try {
            await ctx.graphManager.removeRecordsFromShard('edges', month, [edge.id])
          } catch {
            // Self-loop may already be absent on disk
          }
          continue
        }
        await ctx.graphManager.writeRecord(
          {
            id: edge.id,
            schemaVersion: 1,
            vaultId,
            vaultName,
            fromId,
            toId,
            edgeType: edge.edgeType,
            props: parseJsonObject(edge.propsJson),
            validFrom: edge.validFrom,
            validTo: edge.validTo,
            isCurrent: edge.isCurrent,
            sourceKind: edge.sourceKind,
            sourceRef: edge.sourceRef,
            sourceExcerpt: edge.sourceExcerpt,
            sourceContentHash: edge.sourceContentHash,
            confidence: edge.confidence,
            origin: preferGraphOrigin(edge.origin),
            reviewStatus:
              edge.reviewStatus === 'pending' || edge.reviewStatus === 'rejected'
                ? edge.reviewStatus
                : 'approved',
            shardMonth: month,
            createdAt: edge.createdAt,
            updatedAt: now,
            deletedAt: null
          },
          { collection: 'edges' }
        )
      }
    }
    try {
      await ctx.graphManager.removeRecordsFromShard(
        'nodes',
        existingLegacy.shardMonth || shardMonth,
        [legacyEntryId]
      )
    } catch {
      // Legacy may already be absent on disk
    }
  }
  const newEdgeIds = new Set<string>()
  for (const record of edgeRecords) {
    newEdgeIds.add(record.id)
    await ctx.graphManager.writeRecord(record, { collection: 'edges' })
  }
  await ctx.graphManager.supersedeAiEdgesBySourceRef(sourceRef, {
    exceptIds: newEdgeIds,
    shardMonth
  })
  return { nodeIds: touchedNodeIds, embeddings: alignedEmbeddings }
}
