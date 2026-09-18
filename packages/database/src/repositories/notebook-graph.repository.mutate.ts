import { and, eq, isNull, like, or } from 'drizzle-orm'
import {
  normalizeGraphDiscriminator,
  normalizeGraphEdgeReviewFields,
  normalizeGraphName,
  shouldKeepIncomingNotebookGraphNodeId
} from '@baishou/shared'
import { isSqliteUniqueConstraintError } from '../utils/sqlite-function-error.util'
import type { ApplyRawNodeResult } from './graph.repository.types'
import {
  notebookGraphAliasesTable,
  notebookGraphEdgesTable,
  notebookGraphNodesTable
} from '../schema/knowledge'
import type { AppDatabase } from '../types'
import type { NotebookGraphQueryOps } from './notebook-graph.repository.query'
import {
  mergeNotebookAliases,
  notebookNodeEmbeddingPatch,
  requireNotebookId
} from './notebook-graph.repository.shared'

export class NotebookGraphMutateOps {
  constructor(
    private readonly db: AppDatabase,
    private readonly lookup: NotebookGraphQueryOps
  ) {}

  async applyRawNode(row: {
    id: string
    vaultId: string
    notebookId: string
    nodeType: string
    name: string
    discriminator?: string
    aliases?: string[]
    summary?: string
    props?: Record<string, unknown>
    mentionCount?: number
    firstSeenAt?: number
    lastSeenAt?: number
    origin?: string
    shardMonth?: string
    reviewStatus?: string
    createdAt: number
    updatedAt: number
    deletedAt?: number | null
    embedding?: number[] | null
    modelId?: string
  }): Promise<ApplyRawNodeResult> {
    const notebookId = requireNotebookId(row.notebookId)
    const vaultId = row.vaultId.trim()
    if (!vaultId) throw new Error('applyRawNode: vaultId required')
    if (row.deletedAt != null) {
      await this.softDeleteNode(row.id, notebookId)
      return { id: row.id }
    }
    const now = Date.now()
    const existingById = await this.lookup.getNodeById(row.id, vaultId, notebookId)
    const aliases = mergeNotebookAliases(existingById?.aliases, [row.name, ...(row.aliases ?? [])])
    const discriminator = normalizeGraphDiscriminator(row.discriminator)
    const embeddingPatch = notebookNodeEmbeddingPatch(row)
    try {
      await this.db
        .insert(notebookGraphNodesTable)
        .values({
          id: row.id,
          vaultId,
          notebookId,
          nodeType: row.nodeType,
          name: row.name,
          nameNormalized: normalizeGraphName(row.name),
          discriminator,
          aliases: JSON.stringify(aliases),
          summary: row.summary || existingById?.summary || '',
          propsJson: JSON.stringify(row.props ?? {}),
          mentionCount: row.mentionCount ?? 0,
          firstSeenAt: row.firstSeenAt ?? now,
          lastSeenAt: row.lastSeenAt ?? now,
          origin: row.origin ?? existingById?.origin ?? 'ai',
          shardMonth: row.shardMonth || existingById?.shardMonth || '',
          reviewStatus: row.reviewStatus ?? existingById?.reviewStatus ?? 'approved',
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          deletedAt: null,
          ...embeddingPatch
        })
        .onConflictDoUpdate({
          target: [notebookGraphNodesTable.id],
          set: {
            vaultId,
            notebookId,
            nodeType: row.nodeType,
            name: row.name,
            nameNormalized: normalizeGraphName(row.name),
            discriminator,
            aliases: JSON.stringify(aliases),
            summary: row.summary || existingById?.summary || '',
            propsJson: JSON.stringify(row.props ?? {}),
            mentionCount: row.mentionCount ?? 0,
            lastSeenAt: row.lastSeenAt ?? now,
            origin: row.origin ?? existingById?.origin ?? 'ai',
            shardMonth: row.shardMonth || existingById?.shardMonth || '',
            reviewStatus: row.reviewStatus ?? existingById?.reviewStatus ?? 'approved',
            updatedAt: row.updatedAt,
            deletedAt: null,
            ...embeddingPatch
          }
        })
      await this.replaceAliases(vaultId, notebookId, row.id, aliases)
      return { id: row.id }
    } catch (error) {
      if (row.nodeType === 'source' || !isSqliteUniqueConstraintError(error)) throw error
      const existing = (
        await this.lookup.findNodesByNameOrAlias(vaultId, notebookId, row.name, row.nodeType)
      ).find((candidate) => candidate.discriminator === discriminator)
      if (!existing || existing.id === row.id) throw error
      const keepIncoming = shouldKeepIncomingNotebookGraphNodeId({
        vaultId,
        notebookId,
        nodeType: row.nodeType,
        name: row.name,
        incomingId: row.id,
        existingId: existing.id,
        discriminator
      })
      const mergedAliases = mergeNotebookAliases(existing.aliases, [
        existing.name,
        row.name,
        ...aliases
      ])
      if (!keepIncoming) {
        await this.remapEdgeEndpoints(vaultId, notebookId, row.id, existing.id)
        await this.db
          .update(notebookGraphNodesTable)
          .set({
            aliases: JSON.stringify(mergedAliases),
            summary: row.summary || existing.summary || '',
            mentionCount: Math.max(row.mentionCount ?? 0, existing.mentionCount ?? 0),
            lastSeenAt: row.lastSeenAt ?? now,
            updatedAt: row.updatedAt,
            deletedAt: null,
            ...embeddingPatch
          })
          .where(
            and(
              eq(notebookGraphNodesTable.id, existing.id),
              eq(notebookGraphNodesTable.notebookId, notebookId)
            )
          )
        await this.replaceAliases(vaultId, notebookId, existing.id, mergedAliases)
        return {
          id: existing.id,
          remappedFrom: row.id,
          remappedFromShardMonth: row.shardMonth || existing.shardMonth,
          writeBackSurvivor: true
        }
      }
      await this.remapEdgeEndpoints(vaultId, notebookId, existing.id, row.id)
      await this.softDeleteNode(existing.id, notebookId, { cascadeEdges: false })
      await this.db
        .insert(notebookGraphNodesTable)
        .values({
          id: row.id,
          vaultId,
          notebookId,
          nodeType: row.nodeType,
          name: row.name,
          nameNormalized: normalizeGraphName(row.name),
          discriminator,
          aliases: JSON.stringify(mergedAliases),
          summary: row.summary || existing.summary || '',
          propsJson: JSON.stringify(row.props ?? {}),
          mentionCount: Math.max(row.mentionCount ?? 0, existing.mentionCount ?? 0),
          firstSeenAt: Math.min(row.firstSeenAt ?? now, existing.firstSeenAt ?? now),
          lastSeenAt: row.lastSeenAt ?? now,
          origin: row.origin ?? existing.origin ?? 'ai',
          shardMonth: row.shardMonth || existing.shardMonth || '',
          reviewStatus: row.reviewStatus ?? existing.reviewStatus ?? 'approved',
          createdAt: existing.createdAt ?? row.createdAt,
          updatedAt: row.updatedAt,
          deletedAt: null,
          ...embeddingPatch
        })
        .onConflictDoUpdate({
          target: [notebookGraphNodesTable.id],
          set: {
            name: row.name,
            nameNormalized: normalizeGraphName(row.name),
            discriminator,
            aliases: JSON.stringify(mergedAliases),
            summary: row.summary || existing.summary || '',
            updatedAt: row.updatedAt,
            deletedAt: null,
            ...embeddingPatch
          }
        })
      await this.replaceAliases(vaultId, notebookId, row.id, mergedAliases)
      return {
        id: row.id,
        remappedFrom: existing.id,
        remappedFromShardMonth: existing.shardMonth,
        writeBackSurvivor: true
      }
    }
  }

  async applyRawEdge(row: {
    id: string
    vaultId: string
    notebookId: string
    fromId: string
    toId: string
    edgeType: string
    props?: Record<string, unknown>
    validFrom?: number | null
    validTo?: number | null
    isCurrent?: boolean
    sourceKind?: string
    sourceRef?: string | null
    sourceExcerpt?: string
    sourceContentHash?: string | null
    confidence?: number
    origin?: string
    reviewStatus?: string
    shardMonth: string
    createdAt: number
    updatedAt: number
    deletedAt?: number | null
  }): Promise<void> {
    const notebookId = requireNotebookId(row.notebookId)
    const vaultId = row.vaultId.trim()
    if (!vaultId) throw new Error('applyRawEdge: vaultId required')
    if (row.deletedAt != null) {
      await this.softDeleteEdge(row.id, notebookId)
      return
    }
    const review = normalizeGraphEdgeReviewFields({
      confidence: row.confidence,
      reviewStatus: row.reviewStatus,
      fallbackConfidence: 100
    })
    await this.db
      .insert(notebookGraphEdgesTable)
      .values({
        id: row.id,
        vaultId,
        notebookId,
        fromId: row.fromId,
        toId: row.toId,
        edgeType: row.edgeType,
        propsJson: JSON.stringify(row.props ?? {}),
        validFrom: row.validFrom ?? null,
        validTo: row.validTo ?? null,
        isCurrent: row.isCurrent === false ? 0 : 1,
        sourceKind: row.sourceKind ?? 'knowledge',
        sourceRef: row.sourceRef ?? null,
        sourceExcerpt: row.sourceExcerpt ?? '',
        sourceContentHash: row.sourceContentHash ?? null,
        confidence: review.confidence,
        origin: row.origin ?? 'ai',
        reviewStatus: review.reviewStatus,
        shardMonth: row.shardMonth,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: null
      })
      .onConflictDoUpdate({
        target: [notebookGraphEdgesTable.id],
        set: {
          vaultId,
          notebookId,
          fromId: row.fromId,
          toId: row.toId,
          edgeType: row.edgeType,
          propsJson: JSON.stringify(row.props ?? {}),
          validFrom: row.validFrom ?? null,
          validTo: row.validTo ?? null,
          isCurrent: row.isCurrent === false ? 0 : 1,
          sourceKind: row.sourceKind ?? 'knowledge',
          sourceRef: row.sourceRef ?? null,
          sourceExcerpt: row.sourceExcerpt ?? '',
          sourceContentHash: row.sourceContentHash ?? null,
          confidence: review.confidence,
          origin: row.origin ?? 'ai',
          reviewStatus: review.reviewStatus,
          shardMonth: row.shardMonth,
          updatedAt: row.updatedAt,
          deletedAt: null
        }
      })
  }

  async softDeleteNode(
    id: string,
    notebookId: string,
    opts?: { cascadeEdges?: boolean }
  ): Promise<void> {
    const nb = requireNotebookId(notebookId)
    if (opts?.cascadeEdges !== false) {
      await this.db
        .delete(notebookGraphEdgesTable)
        .where(
          and(
            eq(notebookGraphEdgesTable.notebookId, nb),
            or(eq(notebookGraphEdgesTable.fromId, id), eq(notebookGraphEdgesTable.toId, id))
          )
        )
    }
    await this.db.delete(notebookGraphAliasesTable).where(eq(notebookGraphAliasesTable.nodeId, id))
    await this.db
      .delete(notebookGraphNodesTable)
      .where(and(eq(notebookGraphNodesTable.id, id), eq(notebookGraphNodesTable.notebookId, nb)))
  }

  async remapEdgeEndpoints(
    vaultId: string,
    notebookId: string,
    fromId: string,
    toId: string
  ): Promise<void> {
    if (!fromId || !toId || fromId === toId) return
    const nb = requireNotebookId(notebookId)
    const now = Date.now()
    await this.db
      .update(notebookGraphEdgesTable)
      .set({ fromId: toId, updatedAt: now })
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vaultId),
          eq(notebookGraphEdgesTable.notebookId, nb),
          eq(notebookGraphEdgesTable.fromId, fromId),
          isNull(notebookGraphEdgesTable.deletedAt)
        )
      )
    await this.db
      .update(notebookGraphEdgesTable)
      .set({ toId: toId, updatedAt: now })
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vaultId),
          eq(notebookGraphEdgesTable.notebookId, nb),
          eq(notebookGraphEdgesTable.toId, fromId),
          isNull(notebookGraphEdgesTable.deletedAt)
        )
      )
  }

  async softDeleteEdge(id: string, notebookId: string): Promise<void> {
    const nb = requireNotebookId(notebookId)
    await this.db
      .delete(notebookGraphEdgesTable)
      .where(and(eq(notebookGraphEdgesTable.id, id), eq(notebookGraphEdgesTable.notebookId, nb)))
  }

  async supersedeAiEdgesBySourcePrefix(opts: {
    notebookId: string
    sourceRefPrefix: string
    exceptIds: Set<string>
  }): Promise<number> {
    const notebookId = requireNotebookId(opts.notebookId)
    const prefix = opts.sourceRefPrefix.trim()
    if (!prefix) return 0
    const rows = await this.db
      .select({ id: notebookGraphEdgesTable.id, origin: notebookGraphEdgesTable.origin })
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.notebookId, notebookId),
          eq(notebookGraphEdgesTable.origin, 'ai'),
          isNull(notebookGraphEdgesTable.deletedAt),
          like(notebookGraphEdgesTable.sourceRef, `${prefix.replace(/%/g, '')}%`)
        )
      )
    let n = 0
    for (const row of rows) {
      if (opts.exceptIds.has(row.id)) continue
      await this.softDeleteEdge(row.id, notebookId)
      n += 1
    }
    return n
  }

  async deleteAllForNotebook(notebookId: string): Promise<void> {
    const nb = requireNotebookId(notebookId)
    await this.db
      .delete(notebookGraphAliasesTable)
      .where(eq(notebookGraphAliasesTable.notebookId, nb))
    await this.db.delete(notebookGraphEdgesTable).where(eq(notebookGraphEdgesTable.notebookId, nb))
    await this.db.delete(notebookGraphNodesTable).where(eq(notebookGraphNodesTable.notebookId, nb))
  }

  async deleteAllForVault(vaultId: string): Promise<void> {
    const id = vaultId.trim()
    if (!id) throw new Error('deleteAllForVault: vaultId is required')
    await this.db.delete(notebookGraphAliasesTable).where(eq(notebookGraphAliasesTable.vaultId, id))
    await this.db.delete(notebookGraphEdgesTable).where(eq(notebookGraphEdgesTable.vaultId, id))
    await this.db.delete(notebookGraphNodesTable).where(eq(notebookGraphNodesTable.vaultId, id))
  }

  async deleteEdgesBySourcePrefix(notebookId: string, sourceId: string): Promise<void> {
    const nb = requireNotebookId(notebookId)
    const prefix = sourceId.trim()
    if (!prefix) return
    await this.db
      .delete(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.notebookId, nb),
          like(notebookGraphEdgesTable.sourceRef, `${prefix.replace(/%/g, '')}%`)
        )
      )
  }

  private async replaceAliases(
    vaultId: string,
    notebookId: string,
    nodeId: string,
    aliases: string[]
  ): Promise<void> {
    await this.db
      .delete(notebookGraphAliasesTable)
      .where(eq(notebookGraphAliasesTable.nodeId, nodeId))
    const seen = new Set<string>()
    for (const alias of aliases) {
      const norm = normalizeGraphName(alias)
      if (!norm || seen.has(norm)) continue
      seen.add(norm)
      await this.db.insert(notebookGraphAliasesTable).values({
        id: `${nodeId}:${norm}`,
        vaultId,
        notebookId,
        nodeId,
        aliasNormalized: norm
      })
    }
  }
}
