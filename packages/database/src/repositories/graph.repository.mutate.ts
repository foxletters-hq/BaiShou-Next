import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import {
  GRAPH_SQL_IN_CHUNK,
  graphNodeIdForEntity,
  normalizeGraphDiscriminator,
  normalizeGraphEdgeReviewFields,
  normalizeGraphName,
  preferGraphOrigin
} from '@baishou/shared'
import { graphEdgesTable, graphNodeAliasesTable, graphNodesTable } from '../schema/graph'
import type { AppDatabase } from '../types'
import type { GraphQueryOps } from './graph.repository.query'
import { chunkIds, mergeAliases, serializeVector } from './graph.repository.shared'
import type { UpsertEdgeInput, UpsertNodeInput } from './graph.repository.types'

export class GraphMutateOps {
  constructor(
    private readonly database: AppDatabase,
    private readonly lookup: GraphQueryOps
  ) {}

  async replaceAliases(vaultId: string, nodeId: string, aliases: string[]): Promise<void> {
    await this.database
      .delete(graphNodeAliasesTable)
      .where(eq(graphNodeAliasesTable.nodeId, nodeId))
    const seen = new Set<string>()
    for (const a of aliases) {
      const norm = normalizeGraphName(a)
      if (!norm || seen.has(norm)) continue
      seen.add(norm)
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `a_${nodeId}_${norm}`
      await this.database.insert(graphNodeAliasesTable).values({
        id,
        vaultId,
        nodeId,
        aliasNormalized: norm
      })
    }
  }

  /**
   * Write a node by id. Without forceId, reuse an exact name/alias hit of the same type.
   * Does not merge by vector similarity — chat/manual writes are explicit.
   */
  async upsertNode(input: UpsertNodeInput): Promise<string> {
    const now = Date.now()
    const name = input.name.trim().replace(/\s+/g, ' ')
    const nameNormalized = normalizeGraphName(name)
    const discriminator = normalizeGraphDiscriminator(input.discriminator)
    const updatedAt = input.updatedAt ?? now
    const createdAt = input.createdAt ?? now

    if (!input.forceId) {
      const existing = (
        await this.lookup.findNodesByNameOrAlias(input.vaultId, name, input.nodeType)
      ).find((row) => row.discriminator === discriminator)
      if (existing) {
        await this.touchNode(existing.id, {
          aliases: mergeAliases(existing.aliases, input.aliases ?? [name]),
          lastSeenAt: input.lastSeenAt ?? now,
          mentionCount: input.mentionCount ?? existing.mentionCount,
          summary: input.summary ?? existing.summary,
          embedding: input.embedding,
          modelId: input.modelId,
          updatedAt,
          name,
          nameNormalized
        })
        return existing.id
      }
    }

    if (!input.id && input.nodeType === 'entry') {
      throw new Error('GraphRepository.upsertNode: entry requires a path-based id')
    }
    const id = input.id ?? graphNodeIdForEntity(input.vaultId, input.nodeType, name, discriminator)

    const aliases = mergeAliases([], input.aliases ?? [name])
    const embeddingBuf = input.embedding?.length ? serializeVector(input.embedding) : null
    const existingById = await this.lookup.getNodeById(id, input.vaultId)
    const origin = preferGraphOrigin(existingById?.origin, input.origin)
    const values = {
      id,
      vaultId: input.vaultId,
      nodeType: input.nodeType,
      name,
      nameNormalized,
      discriminator,
      aliases: JSON.stringify(aliases),
      summary: input.summary ?? '',
      propsJson: input.propsJson ?? '{}',
      embedding: embeddingBuf,
      dimension: input.embedding?.length ?? null,
      modelId: input.modelId ?? '',
      mentionCount: input.mentionCount ?? 1,
      firstSeenAt: input.firstSeenAt != null ? new Date(input.firstSeenAt) : new Date(createdAt),
      lastSeenAt: input.lastSeenAt != null ? new Date(input.lastSeenAt) : new Date(updatedAt),
      origin,
      shardMonth: input.shardMonth ?? '',
      reviewStatus: input.reviewStatus ?? 'approved',
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      deletedAt: input.deletedAt != null ? new Date(input.deletedAt) : null
    }

    const conflictSet = {
      name: values.name,
      nameNormalized: values.nameNormalized,
      discriminator: values.discriminator,
      aliases: values.aliases,
      summary: values.summary,
      propsJson: values.propsJson,
      mentionCount: values.mentionCount,
      lastSeenAt: values.lastSeenAt,
      origin: values.origin,
      shardMonth: values.shardMonth,
      reviewStatus: values.reviewStatus,
      updatedAt: values.updatedAt,
      deletedAt: values.deletedAt,
      ...(input.embedding?.length
        ? {
            embedding: embeddingBuf,
            dimension: input.embedding.length,
            modelId: input.modelId ?? ''
          }
        : {})
    }

    await this.database
      .insert(graphNodesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [graphNodesTable.id],
        set: conflictSet
      })
    await this.replaceAliases(input.vaultId, id, aliases)
    return id
  }

  private async touchNode(
    id: string,
    patch: {
      aliases: string[]
      lastSeenAt: number
      mentionCount: number
      summary: string
      embedding?: number[] | null
      modelId?: string
      updatedAt: number
      name?: string
      nameNormalized?: string
    }
  ): Promise<void> {
    const set: Record<string, unknown> = {
      aliases: JSON.stringify(patch.aliases),
      lastSeenAt: new Date(patch.lastSeenAt),
      mentionCount: patch.mentionCount,
      summary: patch.summary,
      updatedAt: new Date(patch.updatedAt),
      deletedAt: null
    }
    if (patch.name) set.name = patch.name
    if (patch.nameNormalized) set.nameNormalized = patch.nameNormalized
    if (patch.embedding?.length) {
      set.embedding = serializeVector(patch.embedding)
      set.dimension = patch.embedding.length
      if (patch.modelId) set.modelId = patch.modelId
    }
    await this.database.update(graphNodesTable).set(set).where(eq(graphNodesTable.id, id))
    const node = await this.lookup.getNodeById(id)
    if (node) await this.replaceAliases(node.vaultId, id, patch.aliases)
  }

  async upsertEdge(input: UpsertEdgeInput): Promise<string> {
    const now = Date.now()
    const createdAt = input.createdAt ?? now
    const updatedAt = input.updatedAt ?? now
    const review = normalizeGraphEdgeReviewFields({
      confidence: input.confidence,
      reviewStatus: input.reviewStatus,
      fallbackConfidence: 100
    })
    const values = {
      id: input.id,
      vaultId: input.vaultId,
      fromId: input.fromId,
      toId: input.toId,
      edgeType: input.edgeType,
      propsJson: input.propsJson ?? '{}',
      validFrom: input.validFrom != null ? new Date(input.validFrom) : null,
      validTo: input.validTo != null ? new Date(input.validTo) : null,
      isCurrent: input.isCurrent ?? true,
      sourceKind: input.sourceKind ?? 'manual',
      sourceRef: input.sourceRef ?? null,
      sourceExcerpt: input.sourceExcerpt ?? '',
      sourceContentHash: input.sourceContentHash ?? null,
      confidence: review.confidence,
      origin: input.origin ?? 'ai',
      reviewStatus: review.reviewStatus,
      shardMonth: input.shardMonth,
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      deletedAt: input.deletedAt != null ? new Date(input.deletedAt) : null
    }
    await this.database
      .insert(graphEdgesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [graphEdgesTable.id],
        set: {
          fromId: values.fromId,
          toId: values.toId,
          edgeType: values.edgeType,
          propsJson: values.propsJson,
          validFrom: values.validFrom,
          validTo: values.validTo,
          isCurrent: values.isCurrent,
          sourceKind: values.sourceKind,
          sourceRef: values.sourceRef,
          sourceExcerpt: values.sourceExcerpt,
          sourceContentHash: values.sourceContentHash,
          confidence: values.confidence,
          origin: values.origin,
          reviewStatus: values.reviewStatus,
          shardMonth: values.shardMonth,
          updatedAt: values.updatedAt,
          deletedAt: values.deletedAt
        }
      })
    return input.id
  }

  async supersedeEdge(edgeId: string, validTo: number): Promise<void> {
    await this.database
      .update(graphEdgesTable)
      .set({
        isCurrent: false,
        validTo: new Date(validTo),
        updatedAt: new Date()
      })
      .where(eq(graphEdgesTable.id, edgeId))
  }

  async supersedeEdgesBySourceRef(
    vaultId: string,
    sourceRef: string,
    opts?: { keepUserOrigin?: boolean; exceptIds?: ReadonlySet<string> }
  ): Promise<void> {
    const now = Date.now()
    const rows = await this.database
      .select()
      .from(graphEdgesTable)
      .where(
        and(
          eq(graphEdgesTable.vaultId, vaultId),
          eq(graphEdgesTable.sourceRef, sourceRef),
          eq(graphEdgesTable.isCurrent, true),
          isNull(graphEdgesTable.deletedAt)
        )
      )
    for (const row of rows) {
      if (opts?.keepUserOrigin && row.origin === 'user') continue
      if (opts?.exceptIds?.has(row.id)) continue
      await this.supersedeEdge(row.id, now)
    }
  }

  /** Removes the node row. Incident edges are removed unless cascadeEdges is false. */
  async softDeleteNode(id: string, opts?: { cascadeEdges?: boolean }): Promise<void> {
    if (opts?.cascadeEdges !== false) {
      await this.database
        .delete(graphEdgesTable)
        .where(or(eq(graphEdgesTable.fromId, id), eq(graphEdgesTable.toId, id)))
    }
    await this.database.delete(graphNodeAliasesTable).where(eq(graphNodeAliasesTable.nodeId, id))
    await this.database.delete(graphNodesTable).where(eq(graphNodesTable.id, id))
  }

  async remapEdgeEndpoints(vaultId: string, fromId: string, toId: string): Promise<void> {
    if (!fromId || !toId || fromId === toId) return
    const now = new Date()
    await this.database
      .update(graphEdgesTable)
      .set({ fromId: toId, updatedAt: now })
      .where(
        and(
          eq(graphEdgesTable.vaultId, vaultId),
          eq(graphEdgesTable.fromId, fromId),
          isNull(graphEdgesTable.deletedAt)
        )
      )
    await this.database
      .update(graphEdgesTable)
      .set({ toId: toId, updatedAt: now })
      .where(
        and(
          eq(graphEdgesTable.vaultId, vaultId),
          eq(graphEdgesTable.toId, fromId),
          isNull(graphEdgesTable.deletedAt)
        )
      )
  }

  /** Removes the edge row. */
  async softDeleteEdge(id: string): Promise<void> {
    await this.database.delete(graphEdgesTable).where(eq(graphEdgesTable.id, id))
  }

  /**
   * Recount mention_count from current live edge endpoints for the given nodes
   * (or all nodes in vault when nodeIds omitted).
   */
  async recountMentions(vaultId: string, nodeIds?: string[]): Promise<void> {
    const ids =
      nodeIds && nodeIds.length > 0
        ? nodeIds
        : (
            await this.database
              .select({ id: graphNodesTable.id })
              .from(graphNodesTable)
              .where(and(eq(graphNodesTable.vaultId, vaultId), isNull(graphNodesTable.deletedAt)))
          ).map((r) => r.id)

    const counts = new Map<string, number>()
    for (const id of ids) counts.set(id, 0)

    const half = Math.max(50, Math.floor(GRAPH_SQL_IN_CHUNK / 2))
    for (const part of chunkIds(ids, half)) {
      const rows = await this.database
        .select({ fromId: graphEdgesTable.fromId, toId: graphEdgesTable.toId })
        .from(graphEdgesTable)
        .where(
          and(
            eq(graphEdgesTable.vaultId, vaultId),
            eq(graphEdgesTable.isCurrent, true),
            isNull(graphEdgesTable.deletedAt),
            or(inArray(graphEdgesTable.fromId, part), inArray(graphEdgesTable.toId, part))
          )
        )
      for (const e of rows) {
        if (counts.has(e.fromId)) counts.set(e.fromId, (counts.get(e.fromId) ?? 0) + 1)
        if (counts.has(e.toId)) counts.set(e.toId, (counts.get(e.toId) ?? 0) + 1)
      }
    }

    const now = new Date()
    const entries = [...counts.entries()]
    for (const part of chunkIds(entries, 80)) {
      if (part.length === 0) continue
      const cases = part.map(([id, count]) => sql`WHEN ${id} THEN ${count}`)
      const ids = part.map(([id]) => id)
      await this.database
        .update(graphNodesTable)
        .set({
          mentionCount: sql`CASE id ${sql.join(cases, sql` `)} ELSE ${graphNodesTable.mentionCount} END`,
          updatedAt: now
        })
        .where(inArray(graphNodesTable.id, ids))
    }
  }

  async deleteAllForVault(vaultId: string): Promise<void> {
    const id = vaultId.trim()
    if (!id) throw new Error('deleteAllForVault: vaultId is required')
    await this.database.delete(graphNodeAliasesTable).where(eq(graphNodeAliasesTable.vaultId, id))
    await this.database.delete(graphEdgesTable).where(eq(graphEdgesTable.vaultId, id))
    await this.database.delete(graphNodesTable).where(eq(graphNodesTable.vaultId, id))
  }
}
