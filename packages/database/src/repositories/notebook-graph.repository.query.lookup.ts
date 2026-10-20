import { and, desc, eq, inArray, isNull, like, or } from 'drizzle-orm'
import { normalizeGraphName } from '@baishou/shared'
import {
  notebookGraphAliasesTable,
  notebookGraphEdgesTable,
  notebookGraphNodesTable,
  type NotebookGraphEdgeRow,
  type NotebookGraphNodeRow
} from '../schema/knowledge'
import type { AppDatabase } from '../types'
import {
  chunkIds,
  compareDiscriminatorAsc,
  requireNotebookId
} from './notebook-graph.repository.shared'

/** 单节点/单边读取与按名称、别名查找。 */
export class NotebookGraphLookupOps {
  constructor(private readonly db: AppDatabase) {}

  async searchNodes(opts: {
    vaultId: string
    notebookId: string
    query: string
    limit?: number
  }): Promise<NotebookGraphNodeRow[]> {
    const notebookId = requireNotebookId(opts.notebookId)
    const vaultId = opts.vaultId.trim()
    if (!vaultId) throw new Error('searchNodes: vaultId required')
    const q = opts.query.trim()
    if (!q) return []
    const likeQ = `%${q.replace(/%/g, '')}%`
    const norm = normalizeGraphName(q)
    const limit = Math.max(1, opts.limit ?? 12)
    const byName = await this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(
        and(
          eq(notebookGraphNodesTable.vaultId, vaultId),
          eq(notebookGraphNodesTable.notebookId, notebookId),
          isNull(notebookGraphNodesTable.deletedAt),
          or(
            like(notebookGraphNodesTable.name, likeQ),
            eq(notebookGraphNodesTable.nameNormalized, norm)
          )
        )
      )
      .orderBy(desc(notebookGraphNodesTable.mentionCount), notebookGraphNodesTable.id)
      .limit(limit)
    const aliasRows = await this.db
      .select({ nodeId: notebookGraphAliasesTable.nodeId })
      .from(notebookGraphAliasesTable)
      .where(
        and(
          eq(notebookGraphAliasesTable.vaultId, vaultId),
          eq(notebookGraphAliasesTable.notebookId, notebookId),
          or(
            eq(notebookGraphAliasesTable.aliasNormalized, norm),
            like(notebookGraphAliasesTable.aliasNormalized, likeQ)
          )
        )
      )
      .limit(limit)
    const seen = new Map<string, (typeof byName)[number]>()
    for (const row of byName) seen.set(row.id, row)
    const missingAliasIds = [
      ...new Set(aliasRows.map((hit) => hit.nodeId).filter((nodeId) => !seen.has(nodeId)))
    ]
    for (const part of chunkIds(missingAliasIds)) {
      const rows = await this.db
        .select()
        .from(notebookGraphNodesTable)
        .where(
          and(
            inArray(notebookGraphNodesTable.id, part),
            eq(notebookGraphNodesTable.vaultId, vaultId),
            eq(notebookGraphNodesTable.notebookId, notebookId),
            isNull(notebookGraphNodesTable.deletedAt)
          )
        )
      for (const row of rows) seen.set(row.id, row)
    }
    return [...seen.values()]
      .sort((a, b) => b.mentionCount - a.mentionCount || a.id.localeCompare(b.id))
      .slice(0, limit)
  }

  async getEdgeById(
    id: string,
    vaultId: string,
    notebookId: string
  ): Promise<NotebookGraphEdgeRow | null> {
    const nb = requireNotebookId(notebookId)
    const rows = await this.db
      .select()
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.id, id),
          eq(notebookGraphEdgesTable.vaultId, vaultId.trim()),
          eq(notebookGraphEdgesTable.notebookId, nb),
          isNull(notebookGraphEdgesTable.deletedAt)
        )
      )
      .limit(1)
    return rows[0] ?? null
  }

  async listPendingNodes(vaultId: string, notebookId: string): Promise<NotebookGraphNodeRow[]> {
    const nb = requireNotebookId(notebookId)
    return this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(
        and(
          eq(notebookGraphNodesTable.vaultId, vaultId.trim()),
          eq(notebookGraphNodesTable.notebookId, nb),
          eq(notebookGraphNodesTable.reviewStatus, 'pending'),
          isNull(notebookGraphNodesTable.deletedAt)
        )
      )
  }

  async listPendingEdges(vaultId: string, notebookId: string): Promise<NotebookGraphEdgeRow[]> {
    const nb = requireNotebookId(notebookId)
    return this.db
      .select()
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vaultId.trim()),
          eq(notebookGraphEdgesTable.notebookId, nb),
          eq(notebookGraphEdgesTable.reviewStatus, 'pending'),
          isNull(notebookGraphEdgesTable.deletedAt)
        )
      )
  }

  async listEdgesTouching(
    vaultId: string,
    notebookId: string,
    nodeId: string
  ): Promise<NotebookGraphEdgeRow[]> {
    const nb = requireNotebookId(notebookId)
    const vid = vaultId.trim()
    const id = nodeId.trim()
    if (!vid || !id) return []
    return this.db
      .select()
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vid),
          eq(notebookGraphEdgesTable.notebookId, nb),
          isNull(notebookGraphEdgesTable.deletedAt),
          or(eq(notebookGraphEdgesTable.fromId, id), eq(notebookGraphEdgesTable.toId, id))
        )
      )
  }

  async getNodeById(
    id: string,
    vaultId: string,
    notebookId: string
  ): Promise<NotebookGraphNodeRow | null> {
    const nb = requireNotebookId(notebookId)
    const rows = await this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(
        and(
          eq(notebookGraphNodesTable.id, id),
          eq(notebookGraphNodesTable.vaultId, vaultId.trim()),
          eq(notebookGraphNodesTable.notebookId, nb),
          isNull(notebookGraphNodesTable.deletedAt)
        )
      )
      .limit(1)
    return rows[0] ?? null
  }

  async findNodesByNameOrAlias(
    vaultId: string,
    notebookId: string,
    name: string,
    nodeType?: string
  ): Promise<NotebookGraphNodeRow[]> {
    const nb = requireNotebookId(notebookId)
    const norm = normalizeGraphName(name)
    if (!norm) return []
    const type = nodeType?.trim().toLowerCase() || ''
    const filters = [
      eq(notebookGraphNodesTable.vaultId, vaultId.trim()),
      eq(notebookGraphNodesTable.notebookId, nb),
      eq(notebookGraphNodesTable.nameNormalized, norm),
      isNull(notebookGraphNodesTable.deletedAt)
    ]
    if (type) filters.push(eq(notebookGraphNodesTable.nodeType, type))
    const byName = await this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(and(...filters))
    const seen = new Map<string, NotebookGraphNodeRow>()
    for (const row of byName) seen.set(row.id, row)

    const aliases = await this.db
      .select({ nodeId: notebookGraphAliasesTable.nodeId })
      .from(notebookGraphAliasesTable)
      .where(
        and(
          eq(notebookGraphAliasesTable.vaultId, vaultId.trim()),
          eq(notebookGraphAliasesTable.notebookId, nb),
          eq(notebookGraphAliasesTable.aliasNormalized, norm)
        )
      )
    const missingAliasIds = [
      ...new Set(aliases.map((hit) => hit.nodeId).filter((nodeId) => !seen.has(nodeId)))
    ]
    for (const part of chunkIds(missingAliasIds)) {
      const byIdFilters = [
        inArray(notebookGraphNodesTable.id, part),
        eq(notebookGraphNodesTable.notebookId, nb),
        isNull(notebookGraphNodesTable.deletedAt)
      ]
      if (type) byIdFilters.push(eq(notebookGraphNodesTable.nodeType, type))
      const byId = await this.db
        .select()
        .from(notebookGraphNodesTable)
        .where(and(...byIdFilters))
      for (const row of byId) seen.set(row.id, row)
    }

    return [...seen.values()].sort((a, b) =>
      compareDiscriminatorAsc(a.discriminator ?? '', b.discriminator ?? '')
    )
  }

  async findNodeByName(
    vaultId: string,
    notebookId: string,
    name: string,
    nodeType?: string
  ): Promise<NotebookGraphNodeRow | null> {
    const nodes = await this.findNodesByNameOrAlias(vaultId, notebookId, name, nodeType)
    const type = nodeType?.trim()
    if (type) return nodes[0] ?? null
    // 未指定类型时跨类型多命中仍闭口，避免把「苹果人」和「苹果主题」合成一条
    const types = new Set(nodes.map((row) => row.nodeType))
    if (types.size !== 1) return null
    return nodes[0] ?? null
  }
}
