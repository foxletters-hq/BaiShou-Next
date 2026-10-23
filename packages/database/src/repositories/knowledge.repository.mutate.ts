import { eq, sql } from 'drizzle-orm'
import type { NotebookGraphWrite } from './notebook-graph.ports'
import {
  knowledgeChunksTable,
  knowledgeEmbedLedgerTable,
  knowledgeIngestJobsTable,
  knowledgeSourcesTable,
  notebooksTable
} from '../schema/knowledge'
import type { AppDatabase } from '../types'
import type { KnowledgeChunkOps } from './knowledge.repository.chunk'
import type { KnowledgeEmbedOps } from './knowledge.repository.embed'
import type { KnowledgeSourceOps } from './knowledge.repository.source'

export class KnowledgeLifecycleOps {
  constructor(
    private readonly db: AppDatabase,
    private readonly chunks: KnowledgeChunkOps,
    private readonly embed: KnowledgeEmbedOps,
    private readonly sources: KnowledgeSourceOps,
    private readonly resolveGraph: () => Promise<NotebookGraphWrite>
  ) {}

  private notebookGraph(): Promise<NotebookGraphWrite> {
    return this.resolveGraph()
  }

  async deleteSource(sourceId: string): Promise<void> {
    await this.chunks.deleteChunksBySource(sourceId)
    await this.embed.deleteEmbedLedgerBySource(sourceId)
    await this.db
      .delete(knowledgeIngestJobsTable)
      .where(eq(knowledgeIngestJobsTable.sourceId, sourceId))
    const source = await this.sources.getSource(sourceId)
    await this.db.delete(knowledgeSourcesTable).where(eq(knowledgeSourcesTable.id, sourceId))
    if (source?.notebookId) {
      const { notebookGraphSourceNodeId } = await import('@baishou/shared')
      const graph = await this.notebookGraph()
      await graph.deleteEdgesBySourcePrefix(source.notebookId, sourceId)
      if (source.vaultId?.trim()) {
        await graph.softDeleteNode(
          notebookGraphSourceNodeId(source.vaultId, source.notebookId, sourceId),
          source.notebookId
        )
      }
    }
  }

  async clearNotebookGraph(notebookId: string): Promise<void> {
    await (await this.notebookGraph()).deleteAllForNotebook(notebookId)
  }

  async deleteNotebook(notebookId: string): Promise<void> {
    const sources = await this.sources.listSources(notebookId)
    await this.chunks.deleteChunksByNotebook(notebookId)
    for (const source of sources) {
      await this.embed.deleteEmbedLedgerBySource(source.id)
    }
    await this.db
      .delete(knowledgeIngestJobsTable)
      .where(eq(knowledgeIngestJobsTable.notebookId, notebookId))
    await this.db
      .delete(knowledgeSourcesTable)
      .where(eq(knowledgeSourcesTable.notebookId, notebookId))
    await (await this.notebookGraph()).deleteAllForNotebook(notebookId)
    await this.db.delete(notebooksTable).where(eq(notebooksTable.id, notebookId))
  }

  /** 按 vault 清知识库派生数据（删仓时调用） */
  async deleteAllForVault(vaultId: string): Promise<{
    notebooks: number
    sources: number
    chunks: number
    jobs: number
  }> {
    const id = vaultId.trim()
    if (!id) throw new Error('deleteAllForVault: vaultId is required')

    const countWhere = async (run: () => Promise<Array<{ c: number }>>): Promise<number> => {
      const rows = await run()
      return Number(rows[0]?.c ?? 0)
    }

    const notebooks = await countWhere(() =>
      this.db
        .select({ c: sql<number>`count(*)` })
        .from(notebooksTable)
        .where(eq(notebooksTable.vaultId, id))
    )
    const sources = await countWhere(() =>
      this.db
        .select({ c: sql<number>`count(*)` })
        .from(knowledgeSourcesTable)
        .where(eq(knowledgeSourcesTable.vaultId, id))
    )
    const chunks = await countWhere(() =>
      this.db
        .select({ c: sql<number>`count(*)` })
        .from(knowledgeChunksTable)
        .where(eq(knowledgeChunksTable.vaultId, id))
    )
    const jobs = await countWhere(() =>
      this.db
        .select({ c: sql<number>`count(*)` })
        .from(knowledgeIngestJobsTable)
        .where(eq(knowledgeIngestJobsTable.vaultId, id))
    )

    await (await this.notebookGraph()).deleteAllForVault(id)
    await this.db.delete(knowledgeIngestJobsTable).where(eq(knowledgeIngestJobsTable.vaultId, id))
    await this.db.delete(knowledgeChunksTable).where(eq(knowledgeChunksTable.vaultId, id))
    await this.db.delete(knowledgeEmbedLedgerTable).where(eq(knowledgeEmbedLedgerTable.vaultId, id))
    await this.db.delete(knowledgeSourcesTable).where(eq(knowledgeSourcesTable.vaultId, id))
    await this.db.delete(notebooksTable).where(eq(notebooksTable.vaultId, id))

    return { notebooks, sources, chunks, jobs }
  }
}
