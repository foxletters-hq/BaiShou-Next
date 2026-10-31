import {
  normalizeGraphDiscriminator,
  preferGraphOrigin,
  shouldKeepIncomingGraphNodeId
} from '@baishou/shared'
import { isSqliteUniqueConstraintError } from '../utils/sqlite-function-error.util'
import type { GraphMutateOps } from './graph.repository.mutate'
import type { GraphQueryOps } from './graph.repository.query'
import { chunkIds, mergeAliases } from './graph.repository.shared'
import type { ApplyRawNodeResult, GraphNodeRow } from './graph.repository.types'

export class GraphSyncOps {
  constructor(
    private readonly lookup: GraphQueryOps,
    private readonly mutate: GraphMutateOps
  ) {}

  /** Apply a collapsed JSONL node row into SQLite (sync path; forceId). */
  async applyRawNode(
    row: {
      id: string
      vaultId: string
      nodeType: string
      name: string
      discriminator?: string
      aliases: string[]
      summary: string
      props: Record<string, unknown>
      mentionCount: number
      firstSeenAt: number
      lastSeenAt: number
      origin: 'ai' | 'user'
      createdAt: number
      updatedAt: number
      deletedAt: number | null
      reviewStatus?: 'approved' | 'pending' | 'rejected'
      shardMonth?: string
      embedding?: number[] | null
      modelId?: string
    },
    existingByIdOption?: GraphNodeRow | null
  ): Promise<ApplyRawNodeResult> {
    if (row.deletedAt != null) {
      await this.mutate.softDeleteNode(row.id)
      return { id: row.id }
    }
    const existingById =
      existingByIdOption !== undefined
        ? existingByIdOption
        : await this.lookup.getNodeById(row.id, row.vaultId)
    const input = {
      id: row.id,
      forceId: true as const,
      existingById,
      vaultId: row.vaultId,
      nodeType: row.nodeType,
      name: row.name,
      discriminator: row.discriminator,
      aliases:
        row.origin === 'user'
          ? mergeAliases([], [row.name, ...(row.aliases ?? [])])
          : mergeAliases(existingById?.aliases ?? [], [row.name, ...(row.aliases ?? [])]),
      summary: row.summary || existingById?.summary || '',
      propsJson: JSON.stringify(row.props ?? {}),
      mentionCount: row.mentionCount,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      origin: row.origin,
      shardMonth: row.shardMonth || existingById?.shardMonth,
      reviewStatus: row.reviewStatus ?? 'approved',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: null,
      embedding: row.embedding,
      modelId: row.modelId
    }
    try {
      await this.mutate.upsertNode(input)
      return { id: row.id }
    } catch (error) {
      if (row.nodeType === 'entry' || !isSqliteUniqueConstraintError(error)) throw error
      const incomingDisc = normalizeGraphDiscriminator(row.discriminator)
      const existing = (
        await this.lookup.findNodesByNameOrAlias(row.vaultId, row.name, row.nodeType)
      ).find((candidate) => candidate.discriminator === incomingDisc)
      if (!existing || existing.id === row.id) throw error
      const keepIncoming = shouldKeepIncomingGraphNodeId({
        vaultId: row.vaultId,
        nodeType: row.nodeType,
        name: row.name,
        incomingId: row.id,
        existingId: existing.id,
        discriminator: incomingDisc
      })
      const mergedAliases = mergeAliases(existing.aliases, [
        existing.name,
        row.name,
        ...(row.aliases ?? [])
      ])
      if (!keepIncoming) {
        await this.mutate.remapEdgeEndpoints(row.vaultId, row.id, existing.id)
        await this.mutate.upsertNode({
          ...input,
          id: existing.id,
          aliases: mergedAliases,
          origin: preferGraphOrigin(existing.origin, row.origin),
          shardMonth: existing.shardMonth || input.shardMonth
        })
        return {
          id: existing.id,
          remappedFrom: row.id,
          remappedFromShardMonth: row.shardMonth || existing.shardMonth,
          writeBackSurvivor: true
        }
      }
      await this.mutate.remapEdgeEndpoints(row.vaultId, existing.id, row.id)
      await this.mutate.softDeleteNode(existing.id, { cascadeEdges: false })
      await this.mutate.upsertNode({
        ...input,
        aliases: mergedAliases,
        origin: preferGraphOrigin(existing.origin, row.origin)
      })
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
    fromId: string
    toId: string
    edgeType: string
    props: Record<string, unknown>
    validFrom: number | null
    validTo: number | null
    isCurrent: boolean
    sourceKind: string
    sourceRef: string | null
    sourceExcerpt: string
    sourceContentHash: string | null
    confidence: number
    origin: 'ai' | 'user'
    reviewStatus: 'approved' | 'pending' | 'rejected'
    shardMonth: string
    createdAt: number
    updatedAt: number
    deletedAt: number | null
  }): Promise<void> {
    if (row.deletedAt != null) {
      await this.mutate.softDeleteEdge(row.id)
      return
    }
    await this.mutate.upsertEdge({
      id: row.id,
      vaultId: row.vaultId,
      fromId: row.fromId,
      toId: row.toId,
      edgeType: row.edgeType,
      propsJson: JSON.stringify(row.props ?? {}),
      validFrom: row.validFrom,
      validTo: row.validTo,
      isCurrent: row.isCurrent,
      sourceKind: row.sourceKind,
      sourceRef: row.sourceRef,
      sourceExcerpt: row.sourceExcerpt,
      sourceContentHash: row.sourceContentHash,
      confidence: row.confidence,
      origin: row.origin,
      reviewStatus: row.reviewStatus,
      shardMonth: row.shardMonth,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: null
    })
  }

  /**
   * Batch apply collapsed JSONL node rows. Uses multi-row INSERT ON CONFLICT DO UPDATE
   * and automatically falls back to single-row applyRawNode on unique constraint conflicts.
   */
  async applyRawNodesBatch(
    rows: Array<
      Parameters<GraphSyncOps['applyRawNode']>[0] & {
        existingById?: GraphNodeRow | null
      }
    >
  ): Promise<ApplyRawNodeResult[]> {
    const out: ApplyRawNodeResult[] = []
    for (const part of chunkIds(rows, 35)) {
      if (part.length === 0) continue
      const inputs = part.map((row) => {
        const existingById = row.existingById ?? null
        return {
          id: row.id,
          forceId: true as const,
          existingById,
          vaultId: row.vaultId,
          nodeType: row.nodeType,
          name: row.name,
          discriminator: row.discriminator,
          aliases:
            row.origin === 'user'
              ? mergeAliases([], [row.name, ...(row.aliases ?? [])])
              : mergeAliases(existingById?.aliases ?? [], [row.name, ...(row.aliases ?? [])]),
          summary: row.summary || existingById?.summary || '',
          propsJson: JSON.stringify(row.props ?? {}),
          mentionCount: row.mentionCount,
          firstSeenAt: row.firstSeenAt,
          lastSeenAt: row.lastSeenAt,
          origin: row.origin,
          shardMonth: row.shardMonth || existingById?.shardMonth,
          reviewStatus: row.reviewStatus ?? 'approved',
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          deletedAt: null,
          embedding: row.embedding,
          modelId: row.modelId
        }
      })
      try {
        await this.mutate.upsertNodesBatch(inputs)
        for (const row of part) {
          out.push({ id: row.id })
        }
      } catch {
        for (const row of part) {
          const applied = await this.applyRawNode(row)
          out.push(applied)
        }
      }
    }
    return out
  }

  async applyRawEdgesBatch(
    rows: Array<Parameters<GraphSyncOps['applyRawEdge']>[0]>
  ): Promise<void> {
    if (rows.length === 0) return
    const inputs = rows.map((row) => ({
      id: row.id,
      vaultId: row.vaultId,
      fromId: row.fromId,
      toId: row.toId,
      edgeType: row.edgeType,
      propsJson: JSON.stringify(row.props ?? {}),
      validFrom: row.validFrom,
      validTo: row.validTo,
      isCurrent: row.isCurrent,
      sourceKind: row.sourceKind,
      sourceRef: row.sourceRef,
      sourceExcerpt: row.sourceExcerpt,
      sourceContentHash: row.sourceContentHash,
      confidence: row.confidence,
      origin: row.origin,
      reviewStatus: row.reviewStatus,
      shardMonth: row.shardMonth,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: null
    }))
    await this.mutate.upsertEdgesBatch(inputs)
  }
}
