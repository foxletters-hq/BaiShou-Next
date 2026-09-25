import {
  KnowledgeGraphExtractionService,
  NotebookGraphIndexService,
  NotebookGraphRawManager
} from '@baishou/core-mobile'
import { NotebookGraphRepository, expoKnowledgeConnectionManager } from '@baishou/database/expo'
import {
  GRAPH_EXTRACT_WINDOW_TIMEOUT_MS,
  isAgentStreamAbortError,
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
    const { providerId, modelId } = resolveGlobalGraphModelIds(globalModels)
    if (!providerId || !modelId) throw new Error('graph-extract-not-configured')

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
      const { createSqlExecutorFromDrizzleDb, SqliteHybridSearchRepository } =
        await import('@baishou/database')
      const { resolveMobileEmbeddingForHydration } =
        await import('./mobile-raw-data-source.runtime')
      const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
      const hsRepo = runtime.drizzleDb
        ? new SqliteHybridSearchRepository(createSqlExecutorFromDrizzleDb(runtime.drizzleDb))
        : undefined
      if (emb.embeddingProvider && emb.embeddingModelId) {
        const adapter = new EmbeddingAdapter(emb.embeddingProvider, emb.embeddingModelId, hsRepo)
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
    await svc.extractSource(input)
  }
}
