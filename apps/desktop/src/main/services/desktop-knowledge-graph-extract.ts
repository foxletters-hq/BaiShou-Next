import { BrowserWindow } from 'electron'
import {
  KnowledgeGraphExtractionService,
  NotebookGraphIndexService,
  NotebookGraphRawManager
} from '@baishou/core-desktop'
import { NotebookGraphRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import {
  GRAPH_EXTRACT_WINDOW_TIMEOUT_MS,
  isAgentStreamAbortError,
  resolveGlobalGraphModelIds,
  resolveReasoningEffortForSlot,
  type GlobalModelsConfig
} from '@baishou/shared'
import { fileSystem } from './node-file-system'
import { pathService, vaultService } from '../ipc/vault.ipc'
import { buildSummaryAiClient } from '../ipc/summary-ai-client'
import { settingsManager } from '../ipc/settings.ipc'
import { resolveDesktopGraphExtractAlignDeps } from './graph-extract-embed-gate'
import {
  clearGraphWindowProgress,
  rememberGraphWindowProgress
} from './graph-window-progress'

function broadcastGraphExtractProgress(progress: {
  notebookId: string
  sourceId: string
  windowsDone: number
  windowsTotal: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}): void {
  rememberGraphWindowProgress(progress)
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
    const { providerId, modelId } = resolveGlobalGraphModelIds(globalModels)
    if (!providerId || !modelId) throw new Error('graph-extract-not-configured')

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
    clearGraphWindowProgress(input.notebookId, input.sourceId)
    const svc = new KnowledgeGraphExtractionService({
      raw,
      repo,
      index,
      getVaultName: () => vaultService.getActiveVault()?.name || 'Personal',
      align: { embedQuery, modelId: embedModelId },
      llm: async ({ system, user }) => {
        // 必须带上图抽取槽位的服务商，否则会落到记忆总结槽位
        try {
          const text = await summaryClient.generateContent(user, modelId, {
            providerId,
            system,
            reasoningEffort: resolveReasoningEffortForSlot(
              globalModels?.reasoningEffortBySlot,
              'graph'
            ),
            abortSignal: AbortSignal.timeout(GRAPH_EXTRACT_WINDOW_TIMEOUT_MS)
          })
          return text ?? null
        } catch (error) {
          if (isAgentStreamAbortError(error)) {
            throw new Error('graph-extract-window-timeout')
          }
          throw error
        }
      }
    })
    await svc.extractSource({
      ...input,
      onProgress: (progress) => {
        broadcastGraphExtractProgress({
          notebookId: input.notebookId,
          sourceId: input.sourceId,
          windowsDone: progress.windowsDone,
          windowsTotal: progress.windowsTotal,
          pageFrom: progress.pageFrom,
          pageTo: progress.pageTo,
          pageTotal: progress.pageTotal
        })
      }
    })
  }
}
