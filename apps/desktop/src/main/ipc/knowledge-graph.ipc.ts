import { BrowserWindow } from 'electron'
import { listLiveGraphSourceIds, NotebookGraphRawManager } from '@baishou/core-desktop'
import { logger } from '@baishou/shared'
import { fileSystem } from '../services/node-file-system'
import {
  reviewNotebookGraphBatch,
  reviewNotebookGraphEdge,
  reviewNotebookGraphNode
} from '../services/notebook-graph-review'
import {
  dismissDesktopNotebookSimilarPair,
  listDesktopNotebookSimilarPairs,
  mergeDesktopNotebookGraphNodeGroup,
  mergeDesktopNotebookGraphNodes
} from '../services/notebook-graph-mutate'
import {
  consumeKnowledgeGraphJobs,
  scheduleConsumeKnowledgeIngestJobs
} from '../services/knowledge-ingest-jobs.consumer'
import { knowledgeConnectionManager } from '@baishou/database-desktop'
import {
  getKnowledgeIngestService,
  handleKnowledgeIpc,
  requireActiveVaultId,
  requireKnowledgeRepo
} from './knowledge-ipc.context'
import { pathService } from './vault.ipc'
import {
  readGraphWindowProgress,
  resolveListedGraphJobStatus,
  resolveListedGraphWindowProgress,
  shouldResumeListedGraphJobs
} from '../services/graph-window-progress'

export function registerKnowledgeGraphIpc(): void {
  handleKnowledgeIpc('knowledge:list-graph-jobs', async (_e, notebookId: string) => {
    const id = String(notebookId || '').trim()
    if (!id) throw new Error('notebookId required')
    const repo = requireKnowledgeRepo()
    const jobs = await repo.listIngestJobs({ notebookId: id, stage: 'graph' })
    const live = new Set(listLiveGraphSourceIds())
    const sources = await repo.listSources(id)
    const titleById = new Map(sources.map((row) => [row.id, row.title]))
    const items = []
    for (const job of jobs) {
      const status = resolveListedGraphJobStatus(job.status, live.has(job.sourceId))
      let checkpoint: { windowsDone: number; windowsTotal: number } | null = null
      try {
        const state = await new NotebookGraphRawManager(pathService, fileSystem).getExtractState(
          id,
          job.sourceId
        )
        if (state && Number(state.windowsTotal) > 0) {
          checkpoint = {
            windowsDone: Number(state.windowsDone) || 0,
            windowsTotal: Number(state.windowsTotal)
          }
        }
      } catch {
        /* 检查点读不到时仍返回任务计数 */
      }
      const resolved = resolveListedGraphWindowProgress({
        running: status === 'running',
        checkpoint,
        live: readGraphWindowProgress(id, job.sourceId)
      })
      items.push({
        sourceId: job.sourceId,
        title: titleById.get(job.sourceId) || job.sourceId,
        status,
        lastError: job.lastError,
        windowsDone: resolved?.windowsDone,
        windowsTotal: resolved?.windowsTotal,
        pageFrom: resolved?.pageFrom,
        pageTo: resolved?.pageTo,
        pageTotal: resolved?.pageTotal
      })
    }
    if (shouldResumeListedGraphJobs(items)) {
      void consumeKnowledgeGraphJobs({ reason: 'list-graph-jobs' }).catch((e) => {
        logger.warn('[KnowledgeGraphJobs] resume leftover graph jobs failed', {
          error: e instanceof Error ? e.message : String(e)
        })
      })
    }
    const running = items.find((item) => item.status === 'running')
    const failedItem = items.find((item) => item.status === 'failed')
    const focus = running || items.find((item) => item.status === 'pending') || failedItem
    return {
      pending: items.filter((item) => item.status === 'pending' || item.status === 'running')
        .length,
      running: items.filter((item) => item.status === 'running').length,
      failed: items.filter((item) => item.status === 'failed').length,
      currentSourceId: running?.sourceId ?? null,
      currentSourceTitle: running?.title ?? null,
      lastError: failedItem?.lastError ?? null,
      failedSourceTitle: failedItem?.title ?? null,
      windowsDone: focus?.windowsDone,
      windowsTotal: focus?.windowsTotal,
      pageFrom: focus?.pageFrom,
      pageTo: focus?.pageTo,
      pageTotal: focus?.pageTotal,
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

  handleKnowledgeIpc(
    'knowledge:merge-graph-nodes',
    async (_e, input: { notebookId: string; survivorId: string; loserId: string; reason?: string }) =>
      mergeDesktopNotebookGraphNodes(input)
  )

  handleKnowledgeIpc(
    'knowledge:merge-graph-nodes-batch',
    async (
      _e,
      input: { notebookId: string; survivorId: string; loserIds: string[]; reason?: string }
    ) => mergeDesktopNotebookGraphNodeGroup(input)
  )

  handleKnowledgeIpc('knowledge:list-graph-similar-pairs', async (_e, notebookId: string) =>
    listDesktopNotebookSimilarPairs(notebookId)
  )

  handleKnowledgeIpc(
    'knowledge:dismiss-graph-similar-pair',
    async (_e, input: { notebookId: string; nodeId: string; peerId: string }) =>
      dismissDesktopNotebookSimilarPair(input)
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
