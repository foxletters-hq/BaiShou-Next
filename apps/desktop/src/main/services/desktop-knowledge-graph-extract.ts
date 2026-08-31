import { BrowserWindow } from 'electron'
import { KnowledgeGraphExtractionService, NotebookGraphIndexService, NotebookGraphRawManager } from '@baishou/core-desktop'
import { NotebookGraphRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import type { GlobalModelsConfig } from '@baishou/shared'
import { fileSystem } from './node-file-system'
import { pathService, vaultService } from '../ipc/vault.ipc'
import { buildSummaryAiClient } from '../ipc/summary-ai-client'
import { settingsManager } from '../ipc/settings.ipc'

function broadcastGraphExtractProgress(progress: {
  notebookId: string
  sourceId: string
  windowsDone: number
  windowsTotal: number
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    try {
      win.webContents.send('knowledge:graph-progress', {
        at: Date.now(),
        ...progress
      })
    } catch {
      /* ignore */
    }
  }
}

export function createDesktopKnowledgeGraphExtractFn() {
  return async (input: {
    vaultId: string
    notebookId: string
    sourceId: string
    sourceTitle: string
    text: string
    textHash: string
    pages?: Array<{ page: number; start: number; end: number }> | null
    force?: boolean
  }): Promise<void> => {
    if (!knowledgeConnectionManager.isConnected()) {
      throw new Error('graph-extract-not-configured')
    }
    const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
    const modelId = globalModels?.globalDialogueModelId || globalModels?.globalSummaryModelId
    if (!modelId) throw new Error('graph-extract-not-configured')

    const raw = new NotebookGraphRawManager(pathService, fileSystem)
    const repo = new NotebookGraphRepository(knowledgeConnectionManager.getDb())
    const index = new NotebookGraphIndexService(raw, repo)
    const summaryClient = buildSummaryAiClient()
    const svc = new KnowledgeGraphExtractionService({
      raw,
      repo,
      index,
      getVaultName: () => vaultService.getActiveVault()?.name || 'Personal',
      llm: async ({ system, user }) => {
        const text = await summaryClient.generateContent(user, modelId, { system })
        return text ?? null
      }
    })
    await svc.extractSource({
      ...input,
      onProgress: (progress) => {
        broadcastGraphExtractProgress({
          notebookId: input.notebookId,
          sourceId: input.sourceId,
          windowsDone: progress.windowsDone,
          windowsTotal: progress.windowsTotal
        })
      }
    })
  }
}
