import { ipcMain } from 'electron'
import path from 'path'
import { KnowledgeRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import { KnowledgeIngestService } from '@baishou/core-desktop'
import { KnowledgeEmbeddingStorage } from '@baishou/ai'
import { logger } from '@baishou/shared'
import { getNotebookRawManager } from '../services/raw-data-source.runtime'
import { fileSystem } from '../services/node-file-system'
import { scheduleConsumeKnowledgeIngestJobs } from '../services/knowledge-ingest-jobs.consumer'

function requireKnowledgeRepo(): KnowledgeRepository {
  if (!knowledgeConnectionManager.isConnected()) {
    throw new Error('knowledge db not connected')
  }
  return new KnowledgeRepository(knowledgeConnectionManager.getDb())
}

function buildIngestService(): KnowledgeIngestService {
  const repo = requireKnowledgeRepo()
  const notebookManager = getNotebookRawManager()
  const storage = new KnowledgeEmbeddingStorage(() => repo)

  return new KnowledgeIngestService({
    repo,
    notebookManager,
    fs: fileSystem,
    insertChunk: async (params) => {
      await storage.insertEmbedding({
        id: params.chunkId,
        sourceType: 'knowledge',
        sourceId: params.sourceId,
        groupId: params.notebookId,
        vaultId: 'knowledge',
        chunkIndex: params.chunkIndex,
        chunkText: params.chunkText,
        metadataJson: params.metadataJson,
        embedding: params.embedding,
        modelId: params.modelId
      })
    },
    deleteChunksBySource: (sourceId) => repo.deleteChunksBySource(sourceId)
  })
}

let ingestService: KnowledgeIngestService | null = null

export function getKnowledgeIngestService(): KnowledgeIngestService {
  if (!ingestService) {
    ingestService = buildIngestService()
  }
  return ingestService
}

export function resetKnowledgeIngestService(): void {
  ingestService = null
}

export function registerKnowledgeIPC(): void {
  ipcMain.handle(
    'knowledge:create-notebook',
    async (_e, input: { name: string; description?: string }) => {
      const svc = getKnowledgeIngestService()
      return svc.createNotebook(input)
    }
  )

  ipcMain.handle('knowledge:list-notebooks', async () => {
    const svc = getKnowledgeIngestService()
    return svc.listNotebooks()
  })

  ipcMain.handle(
    'knowledge:import-source',
    async (
      _e,
      input: {
        notebookId: string
        title: string
        kind: 'file' | 'text'
        absolutePath?: string
        textContent?: string
        fileName?: string
      }
    ) => {
      const svc = getKnowledgeIngestService()
      const result = await svc.importSource({
        ...input,
        fileName:
          input.fileName ||
          (input.absolutePath ? path.basename(input.absolutePath) : input.title)
      })
      scheduleConsumeKnowledgeIngestJobs('after-import')
      return result
    }
  )

  ipcMain.handle('knowledge:retry-source', async (_e, sourceId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.retrySource(sourceId)
    scheduleConsumeKnowledgeIngestJobs('after-retry')
    return { ok: true }
  })

  ipcMain.handle('knowledge:rebuild-index', async (_e, notebookId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.rebuildIndex(notebookId)
    scheduleConsumeKnowledgeIngestJobs('after-rebuild')
    return { ok: true }
  })

  ipcMain.handle('knowledge:get-stats', async (_e, notebookId?: string) => {
    const repo = requireKnowledgeRepo()
    return repo.getStats(notebookId)
  })

  ipcMain.handle('knowledge:list-sources', async (_e, notebookId: string) => {
    const repo = requireKnowledgeRepo()
    return repo.listSources(notebookId)
  })

  logger.info('[KnowledgeIPC] handlers registered')
}
