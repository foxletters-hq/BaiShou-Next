import type { AppDatabase } from '../types'
import type { NotebookGraphWrite } from './notebook-graph.ports'
import { KnowledgeChunkOps } from './knowledge.repository.chunk'
import { KnowledgeEmbedOps } from './knowledge.repository.embed'
import { KnowledgeIngestOps } from './knowledge.repository.ingest'
import { KnowledgeLifecycleOps } from './knowledge.repository.mutate'
import { KnowledgeNotebookOps } from './knowledge.repository.notebook'
import { KnowledgeSourceOps } from './knowledge.repository.source'
import { KnowledgeStatsOps } from './knowledge.repository.stats'

export type {
  KnowledgeChunkListItem,
  KnowledgeEmbedLedgerRecord,
  KnowledgeEmbedLedgerView,
  KnowledgeIngestJobStatus,
  KnowledgeIngestStage,
  KnowledgeSourceStatus
} from './knowledge.repository.types'

export class KnowledgeRepository {
  private readonly notebooks: KnowledgeNotebookOps
  private readonly sources: KnowledgeSourceOps
  private readonly chunks: KnowledgeChunkOps
  private readonly ingest: KnowledgeIngestOps
  private readonly stats: KnowledgeStatsOps
  private readonly embed: KnowledgeEmbedOps
  private readonly lifecycle: KnowledgeLifecycleOps

  constructor(
    private readonly db: AppDatabase,
    private readonly notebookGraphWrite?: NotebookGraphWrite
  ) {
    this.notebooks = new KnowledgeNotebookOps(db)
    this.sources = new KnowledgeSourceOps(db)
    this.chunks = new KnowledgeChunkOps(db)
    this.ingest = new KnowledgeIngestOps(db)
    this.stats = new KnowledgeStatsOps(db, this.chunks, this.ingest)
    this.embed = new KnowledgeEmbedOps(db)
    this.lifecycle = new KnowledgeLifecycleOps(db, this.chunks, this.embed, this.sources, () =>
      this.notebookGraph()
    )
  }

  private async notebookGraph(): Promise<NotebookGraphWrite> {
    if (this.notebookGraphWrite) return this.notebookGraphWrite
    const { NotebookGraphRepository } = await import('./notebook-graph.repository')
    return new NotebookGraphRepository(this.db)
  }

  createNotebook(...args: Parameters<KnowledgeNotebookOps['createNotebook']>) {
    return this.notebooks.createNotebook(...args)
  }

  getNotebook(...args: Parameters<KnowledgeNotebookOps['getNotebook']>) {
    return this.notebooks.getNotebook(...args)
  }

  listNotebooks(...args: Parameters<KnowledgeNotebookOps['listNotebooks']>) {
    return this.notebooks.listNotebooks(...args)
  }

  updateNotebook(...args: Parameters<KnowledgeNotebookOps['updateNotebook']>) {
    return this.notebooks.updateNotebook(...args)
  }

  upsertSource(...args: Parameters<KnowledgeSourceOps['upsertSource']>) {
    return this.sources.upsertSource(...args)
  }

  getSource(...args: Parameters<KnowledgeSourceOps['getSource']>) {
    return this.sources.getSource(...args)
  }

  listSources(...args: Parameters<KnowledgeSourceOps['listSources']>) {
    return this.sources.listSources(...args)
  }

  updateSourceStatus(...args: Parameters<KnowledgeSourceOps['updateSourceStatus']>) {
    return this.sources.updateSourceStatus(...args)
  }

  listSourcesByStatus(...args: Parameters<KnowledgeSourceOps['listSourcesByStatus']>) {
    return this.sources.listSourcesByStatus(...args)
  }

  insertChunk(...args: Parameters<KnowledgeChunkOps['insertChunk']>) {
    return this.chunks.insertChunk(...args)
  }

  async deleteChunksBySource(sourceId: string): Promise<void> {
    await this.chunks.deleteChunksBySource(sourceId)
    await this.embed.deleteEmbedLedgerBySource(sourceId)
  }

  async deleteChunksByNotebook(notebookId: string): Promise<void> {
    const sources = await this.sources.listSources(notebookId)
    await this.chunks.deleteChunksByNotebook(notebookId)
    for (const source of sources) {
      await this.embed.deleteEmbedLedgerBySource(source.id)
    }
  }

  countChunks(...args: Parameters<KnowledgeChunkOps['countChunks']>) {
    return this.chunks.countChunks(...args)
  }

  listChunksBySource(...args: Parameters<KnowledgeChunkOps['listChunksBySource']>) {
    return this.chunks.listChunksBySource(...args)
  }

  listChunksByNotebook(...args: Parameters<KnowledgeChunkOps['listChunksByNotebook']>) {
    return this.chunks.listChunksByNotebook(...args)
  }

  countChunksBySource(...args: Parameters<KnowledgeChunkOps['countChunksBySource']>) {
    return this.chunks.countChunksBySource(...args)
  }

  deleteChunksBySourceFromIndex(
    ...args: Parameters<KnowledgeChunkOps['deleteChunksBySourceFromIndex']>
  ) {
    return this.chunks.deleteChunksBySourceFromIndex(...args)
  }

  listDistinctSourceIds(...args: Parameters<KnowledgeChunkOps['listDistinctSourceIds']>) {
    return this.chunks.listDistinctSourceIds(...args)
  }

  countHeterogeneousEmbeddings(
    ...args: Parameters<KnowledgeChunkOps['countHeterogeneousEmbeddings']>
  ) {
    return this.chunks.countHeterogeneousEmbeddings(...args)
  }

  listNotebookEmbeddingProfiles(
    ...args: Parameters<KnowledgeChunkOps['listNotebookEmbeddingProfiles']>
  ) {
    return this.chunks.listNotebookEmbeddingProfiles(...args)
  }

  searchChunksLike(...args: Parameters<KnowledgeChunkOps['searchChunksLike']>) {
    return this.chunks.searchChunksLike(...args)
  }

  deleteSource(...args: Parameters<KnowledgeLifecycleOps['deleteSource']>) {
    return this.lifecycle.deleteSource(...args)
  }

  clearNotebookGraph(...args: Parameters<KnowledgeLifecycleOps['clearNotebookGraph']>) {
    return this.lifecycle.clearNotebookGraph(...args)
  }

  deleteNotebook(...args: Parameters<KnowledgeLifecycleOps['deleteNotebook']>) {
    return this.lifecycle.deleteNotebook(...args)
  }

  deleteAllForVault(...args: Parameters<KnowledgeLifecycleOps['deleteAllForVault']>) {
    return this.lifecycle.deleteAllForVault(...args)
  }

  enqueueIngestJob(...args: Parameters<KnowledgeIngestOps['enqueueIngestJob']>) {
    return this.ingest.enqueueIngestJob(...args)
  }

  countIngestJobs(...args: Parameters<KnowledgeIngestOps['countIngestJobs']>) {
    return this.ingest.countIngestJobs(...args)
  }

  claimIngestJobs(...args: Parameters<KnowledgeIngestOps['claimIngestJobs']>) {
    return this.ingest.claimIngestJobs(...args)
  }

  completeIngestJob(...args: Parameters<KnowledgeIngestOps['completeIngestJob']>) {
    return this.ingest.completeIngestJob(...args)
  }

  reclaimStaleRunningIngestJobs(
    ...args: Parameters<KnowledgeIngestOps['reclaimStaleRunningIngestJobs']>
  ) {
    return this.ingest.reclaimStaleRunningIngestJobs(...args)
  }

  reclaimRunningIngestJobs(...args: Parameters<KnowledgeIngestOps['reclaimRunningIngestJobs']>) {
    return this.ingest.reclaimRunningIngestJobs(...args)
  }

  listIngestJobsByStatus(...args: Parameters<KnowledgeIngestOps['listIngestJobsByStatus']>) {
    return this.ingest.listIngestJobsByStatus(...args)
  }

  listIngestJobsBySource(...args: Parameters<KnowledgeIngestOps['listIngestJobsBySource']>) {
    return this.ingest.listIngestJobsBySource(...args)
  }

  deleteIngestJobsForSource(...args: Parameters<KnowledgeIngestOps['deleteIngestJobsForSource']>) {
    return this.ingest.deleteIngestJobsForSource(...args)
  }

  failIngestJob(...args: Parameters<KnowledgeIngestOps['failIngestJob']>) {
    return this.ingest.failIngestJob(...args)
  }

  listIngestJobs(...args: Parameters<KnowledgeIngestOps['listIngestJobs']>) {
    return this.ingest.listIngestJobs(...args)
  }

  getStats(...args: Parameters<KnowledgeStatsOps['getStats']>) {
    return this.stats.getStats(...args)
  }

  listNotebookStats(...args: Parameters<KnowledgeStatsOps['listNotebookStats']>) {
    return this.stats.listNotebookStats(...args)
  }

  getEmbedLedger(...args: Parameters<KnowledgeEmbedOps['getEmbedLedger']>) {
    return this.embed.getEmbedLedger(...args)
  }

  recordEmbedded(...args: Parameters<KnowledgeEmbedOps['recordEmbedded']>) {
    return this.embed.recordEmbedded(...args)
  }

  recordEmbedFailure(...args: Parameters<KnowledgeEmbedOps['recordEmbedFailure']>) {
    return this.embed.recordEmbedFailure(...args)
  }

  deleteEmbedLedgerBySource(...args: Parameters<KnowledgeEmbedOps['deleteEmbedLedgerBySource']>) {
    return this.embed.deleteEmbedLedgerBySource(...args)
  }

  reconcileEmbedLedger(...args: Parameters<KnowledgeEmbedOps['reconcileEmbedLedger']>) {
    return this.embed.reconcileEmbedLedger(...args)
  }

  rebuildEmbedLedger(...args: Parameters<KnowledgeEmbedOps['rebuildEmbedLedger']>) {
    return this.embed.rebuildEmbedLedger(...args)
  }

  countPendingEmbedSources(...args: Parameters<KnowledgeEmbedOps['countPendingEmbedSources']>) {
    return this.embed.countPendingEmbedSources(...args)
  }

  listPendingEmbedSources(...args: Parameters<KnowledgeEmbedOps['listPendingEmbedSources']>) {
    return this.embed.listPendingEmbedSources(...args)
  }
}
