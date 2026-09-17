import { BrowserWindow } from 'electron'
import {
  KnowledgeGraphExtractionService,
  NotebookGraphIndexService,
  NotebookGraphRawManager
} from '@baishou/core-desktop'
import { NotebookGraphRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import {
  resolveGlobalGraphModelIds,
  resolveReasoningEffortForSlot,
  type GlobalModelsConfig
} from '@baishou/shared'
import { fileSystem } from './node-file-system'
import { pathService, vaultService } from '../ipc/vault.ipc'
import { buildSummaryAiClient } from '../ipc/summary-ai-client'
import { settingsManager } from '../ipc/settings.ipc'
import { resolveDesktopGraphExtractAlignDeps } from './graph-extract-embed-gate'

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
    const { modelId } = resolveGlobalGraphModelIds(globalModels)
    if (!modelId) throw new Error('graph-extract-not-configured')

    const raw = new NotebookGraphRawManager(pathService, fileSystem)
    const repo = new NotebookGraphRepository(knowledgeConnectionManager.getDb())
    const index = new NotebookGraphIndexService(raw, repo)
    const summaryClient = buildSummaryAiClient()
    let embedQuery: ((text: string) => Promise<number[] | null>) | undefined
    let embedModelId: string | undefined
    try {
      const alignDeps = await resolveDesktopGraphExtractAlignDeps(input.vaultId)
      embedQuery = alignDeps.embedQuery
      embedModelId = alignDeps.modelId
    } catch {
      // 没配嵌入时按名字对齐，抽图本身不能失败
    }
    const svc = new KnowledgeGraphExtractionService({
      raw,
      repo,
      index,
      getVaultName: () => vaultService.getActiveVault()?.name || 'Personal',
      align: { embedQuery, modelId: embedModelId },
      llm: async ({ system, user }) => {
        const text = await summaryClient.generateContent(user, modelId, {
          system,
          reasoningEffort: resolveReasoningEffortForSlot(
            globalModels?.reasoningEffortBySlot,
            'graph'
          )
        })
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
