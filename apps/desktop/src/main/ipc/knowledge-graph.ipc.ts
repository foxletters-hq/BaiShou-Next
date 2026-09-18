import { BrowserWindow } from 'electron'
import { listLiveGraphSourceIds } from '@baishou/core-desktop'
import {
  reviewNotebookGraphBatch,
  reviewNotebookGraphEdge,
  reviewNotebookGraphNode
} from '../services/notebook-graph-review'
import { scheduleConsumeKnowledgeIngestJobs } from '../services/knowledge-ingest-jobs.consumer'
import { knowledgeConnectionManager } from '@baishou/database-desktop'
import {
  getKnowledgeIngestService,
  handleKnowledgeIpc,
  requireActiveVaultId,
  requireKnowledgeRepo
} from './knowledge-ipc.context'

export function registerKnowledgeGraphIpc(): void {
  handleKnowledgeIpc('knowledge:list-graph-jobs', async (_e, notebookId: string) => {
    const id = String(notebookId || '').trim()
    if (!id) throw new Error('notebookId required')
    const repo = requireKnowledgeRepo()
    const jobs = await repo.listIngestJobs({ notebookId: id, stage: 'graph' })
    const live = new Set(listLiveGraphSourceIds())
    const sources = await repo.listSources(id)
    const titleById = new Map(sources.map((row) => [row.id, row.title]))
    const items = jobs.map((job) => ({
      sourceId: job.sourceId,
      title: titleById.get(job.sourceId) || job.sourceId,
      status: live.has(job.sourceId) ? 'running' : job.status,
      lastError: job.lastError
    }))
    const running = items.find((item) => item.status === 'running')
    return {
      pending: items.filter((item) => item.status === 'pending' || item.status === 'running')
        .length,
      running: items.filter((item) => item.status === 'running').length,
      failed: items.filter((item) => item.status === 'failed').length,
      currentSourceId: running?.sourceId ?? null,
      currentSourceTitle: running?.title ?? null,
      items
    }
  })

  handleKnowledgeIpc(
    'knowledge:get-graph-view',
    async (_e, input: { notebookId: string; maxNodes?: number }) => {
      const notebookId = String(input?.notebookId || '').trim()
      if (!notebookId) throw new Error('notebookId required')
      requireKnowledgeRepo()
      const { NotebookGraphRepository } = await import('@baishou/database-desktop')
      const repo = new NotebookGraphRepository(knowledgeConnectionManager.getDb())
      return repo.getView({
        vaultId: requireActiveVaultId(),
        notebookId,
        maxNodes: input.maxNodes
      })
    }
  )

  handleKnowledgeIpc(
    'knowledge:graph-search',
    async (_e, input: { notebookId: string; query: string; limit?: number }) => {
      const notebookId = String(input?.notebookId || '').trim()
      if (!notebookId) throw new Error('notebookId required')
      requireKnowledgeRepo()
      const { NotebookGraphRepository } = await import('@baishou/database-desktop')
      const repo = new NotebookGraphRepository(knowledgeConnectionManager.getDb())
      return repo.searchNodes({
        vaultId: requireActiveVaultId(),
        notebookId,
        query: String(input.query || ''),
        limit: input.limit
      })
    }
  )

  handleKnowledgeIpc(
    'knowledge:set-graph-node-review',
    async (
      _e,
      input: { notebookId: string; nodeId: string; reviewStatus: 'approved' | 'rejected' }
    ) => reviewNotebookGraphNode(input)
  )

  handleKnowledgeIpc(
    'knowledge:set-graph-edge-review',
    async (
      _e,
      input: { notebookId: string; edgeId: string; reviewStatus: 'approved' | 'rejected' }
    ) => reviewNotebookGraphEdge(input)
  )

  handleKnowledgeIpc(
    'knowledge:set-graph-reviews-batch',
    async (
      _e,
      input: {
        notebookId: string
        reviewStatus: 'approved' | 'rejected'
        nodeIds?: string[]
        edgeIds?: string[]
        allPending?: boolean
      }
    ) => reviewNotebookGraphBatch(input)
  )

  handleKnowledgeIpc('knowledge:rebuild-graph', async (_e, notebookId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.rebuildNotebookGraph(String(notebookId || ''))
    scheduleConsumeKnowledgeIngestJobs('after-rebuild-graph')
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      try {
        win.webContents.send('knowledge:graph-progress', { at: Date.now() })
      } catch {
        /* ignore */
      }
    }
    return { ok: true }
  })
}
