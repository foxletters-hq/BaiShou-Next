import {
  KnowledgeGraphExtractionService,
  NotebookGraphIndexService,
  NotebookGraphRawManager
} from '@baishou/core-mobile'
import { NotebookGraphRepository, expoKnowledgeConnectionManager } from '@baishou/database/expo'
import {
  resolveGlobalGraphModelIds,
  resolveReasoningEffortForSlot,
  type GlobalModelsConfig
} from '@baishou/shared'
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
    const { modelId } = resolveGlobalGraphModelIds(globalModels)
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
    let embedQuery: ((text: string) => Promise<number[] | null>) | undefined
    let embedModelId: string | undefined
    try {
      const { EmbeddingAdapter } = await import('@baishou/ai')
      const { resolveMobileEmbeddingForHydration } =
        await import('./mobile-raw-data-source.runtime')
      const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
      if (emb.embeddingProvider && emb.embeddingModelId) {
        const adapter = new EmbeddingAdapter(emb.embeddingProvider, emb.embeddingModelId)
        if (adapter.isConfigured) {
          embedQuery = (text) => adapter.embedQuery(text)
          embedModelId = adapter.embeddingModelId
        }
      }
    } catch {
      // 没配嵌入时按名字对齐，抽图本身不能失败
    }
    const svc = new KnowledgeGraphExtractionService({
      raw,
      repo,
      index,
      getVaultName: () => vaultName,
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
    await svc.extractSource(input)
  }
}
