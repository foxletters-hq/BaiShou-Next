import { KnowledgeGraphExtractionService, NotebookGraphIndexService, NotebookGraphRawManager } from '@baishou/core-mobile'
import { NotebookGraphRepository, expoKnowledgeConnectionManager } from '@baishou/database/expo'
import type { GlobalModelsConfig } from '@baishou/shared'
import { createMobileFileSystem } from './create-mobile-file-system'
import { MobileStoragePathService } from './path.service'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { buildMobileSummaryAiClient } from './mobile-summary-ai-client'

export function createMobileKnowledgeGraphExtractFn() {
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
    if (!expoKnowledgeConnectionManager.isConnected()) {
      throw new Error('graph-extract-not-configured')
    }
    const runtime = agentDbRuntimeRef.current
    if (!runtime?.settingsManager || !runtime.pathService) {
      throw new Error('graph-extract-not-configured')
    }
    const globalModels = await runtime.settingsManager.get<GlobalModelsConfig>('global_models')
    const modelId = globalModels?.globalDialogueModelId || globalModels?.globalSummaryModelId
    if (!modelId) throw new Error('graph-extract-not-configured')

    const fileSystem = createMobileFileSystem()
    const pathService =
      (runtime.pathService as MobileStoragePathService) || new MobileStoragePathService(fileSystem)
    const raw = new NotebookGraphRawManager(pathService, fileSystem)
    const repo = new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
    const index = new NotebookGraphIndexService(raw, repo)
    const summaryClient = buildMobileSummaryAiClient(runtime.settingsManager)
    const vaultName =
      (await pathService.getActiveVaultNameForContext?.().catch(() => 'Personal')) || 'Personal'
    const svc = new KnowledgeGraphExtractionService({
      raw,
      repo,
      index,
      getVaultName: () => vaultName,
      llm: async ({ system, user }) => {
        const text = await summaryClient.generateContent(user, modelId, { system })
        return text ?? null
      }
    })
    await svc.extractSource(input)
  }
}
