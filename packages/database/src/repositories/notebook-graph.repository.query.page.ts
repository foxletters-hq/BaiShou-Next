import { and, desc, eq, isNull, like, or, sql } from 'drizzle-orm'
import {
  notebookGraphEdgesTable,
  notebookGraphNodesTable,
  type NotebookGraphNodeRow
} from '../schema/knowledge'
import type { AppDatabase } from '../types'
import { requireNotebookId } from './notebook-graph.repository.shared'
import { NOTEBOOK_GRAPH_VIEW_NODE_COLUMNS } from './notebook-graph.repository.query.columns'

/** 节点分页列表与数量统计。 */
export class NotebookGraphPageOps {
  constructor(private readonly db: AppDatabase) {}

  async listNodesPage(opts: {
    vaultId: string
    notebookId: string
    keyword?: string
    limit?: number
    offset?: number
  }): Promise<NotebookGraphNodeRow[]> {
    const notebookId = requireNotebookId(opts.notebookId)
    const vaultId = opts.vaultId.trim()
    if (!vaultId) throw new Error('listNodesPage: vaultId required')
    const conditions = [
      eq(notebookGraphNodesTable.vaultId, vaultId),
      eq(notebookGraphNodesTable.notebookId, notebookId),
      isNull(notebookGraphNodesTable.deletedAt),
      sql`${notebookGraphNodesTable.reviewStatus} != 'rejected'`
    ]
    const q = opts.keyword?.trim()
    if (q) {
      const pattern = `%${q.replace(/%/g, '')}%`
      conditions.push(
        or(
          like(notebookGraphNodesTable.name, pattern),
          like(notebookGraphNodesTable.summary, pattern),
          like(notebookGraphNodesTable.discriminator, pattern),
          like(notebookGraphNodesTable.nodeType, pattern)
        )!
      )
    }
    const limit = Math.max(1, opts.limit ?? 20)
    const offset = Math.max(0, opts.offset ?? 0)
    const rows = await this.db
      .select(NOTEBOOK_GRAPH_VIEW_NODE_COLUMNS)
      .from(notebookGraphNodesTable)
      .where(and(...conditions))
      .orderBy(
        sql`case when ${notebookGraphNodesTable.reviewStatus} = 'pending' then 0 else 1 end`,
        desc(notebookGraphNodesTable.mentionCount),
        notebookGraphNodesTable.name,
        notebookGraphNodesTable.id
      )
      .limit(limit)
      .offset(offset)
    return rows as NotebookGraphNodeRow[]
  }

  async countNodes(opts: {
    vaultId: string
    notebookId: string
    keyword?: string
  }): Promise<number> {
    const notebookId = requireNotebookId(opts.notebookId)
    const vaultId = opts.vaultId.trim()
    if (!vaultId) throw new Error('countNodes: vaultId required')
    const conditions = [
      eq(notebookGraphNodesTable.vaultId, vaultId),
      eq(notebookGraphNodesTable.notebookId, notebookId),
      isNull(notebookGraphNodesTable.deletedAt),
      sql`${notebookGraphNodesTable.reviewStatus} != 'rejected'`
    ]
    const q = opts.keyword?.trim()
    if (q) {
      const pattern = `%${q.replace(/%/g, '')}%`
      conditions.push(
        or(
          like(notebookGraphNodesTable.name, pattern),
          like(notebookGraphNodesTable.summary, pattern),
          like(notebookGraphNodesTable.discriminator, pattern),
          like(notebookGraphNodesTable.nodeType, pattern)
        )!
      )
    }
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notebookGraphNodesTable)
      .where(and(...conditions))
    return Number(rows[0]?.count ?? 0)
  }

  async countCurrentEdges(opts: { vaultId: string; notebookId: string }): Promise<number> {
    const notebookId = requireNotebookId(opts.notebookId)
    const vaultId = opts.vaultId.trim()
    if (!vaultId) throw new Error('countCurrentEdges: vaultId required')
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vaultId),
          eq(notebookGraphEdgesTable.notebookId, notebookId),
          eq(notebookGraphEdgesTable.isCurrent, 1),
          isNull(notebookGraphEdgesTable.deletedAt),
          sql`${notebookGraphEdgesTable.reviewStatus} != 'rejected'`
        )
      )
    return Number(rows[0]?.count ?? 0)
  }
}
