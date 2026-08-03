import { EmbeddingAdapter } from '@baishou/ai'
import { deriveLegacyVaultId, logger } from '@baishou/shared'
import type { VaultService } from '@baishou/core-mobile'
import { agentDbRuntimeRef } from '../../services/mobile-agent-db-runtime-ref'
import type { AIProviderRegistry } from '@baishou/ai'
import type { MobileStoragePathService } from '../../services/path.service'

export function createMemorySearch(deps: {
  pathService: MobileStoragePathService
  registry: AIProviderRegistry
  agentDbRuntimeRef: typeof agentDbRuntimeRef
  vaultService?: VaultService
}) {
  const { pathService, registry, vaultService } = deps
  return async (
    query: string,
    options?: { topK?: number; minScore?: number }
  ): Promise<Array<{ chunkText: string; score: number; createdAt?: number }>> => {
    if (!query.trim()) return []
    const runtime = agentDbRuntimeRef.current
    if (!runtime) return []
    let activeVaultId: string
    try {
      if (vaultService) {
        await vaultService.initRegistry()
        activeVaultId = vaultService.getActiveVault()?.id ?? ''
      } else {
        activeVaultId = ''
      }
    } catch {
      activeVaultId = ''
    }
    if (!activeVaultId) {
      const activeVaultName = await pathService
        .getActiveVaultNameForContext()
        .catch(() => 'Personal')
      activeVaultId = deriveLegacyVaultId(activeVaultName)
    }
    const mapResults = (
      rows: Array<{
        chunkText: string
        score: number
        createdAt?: number
      }>
    ) =>
      rows.map((r) => ({
        chunkText: r.chunkText,
        score: r.score,
        createdAt: r.createdAt
      }))
    try {
      const providers = (await runtime.settingsManager.get<any[]>('ai_providers')) || []
      const globalModels = await runtime.settingsManager.get<any>('global_models')

      // 获取嵌入模型配置
      const embeddingProviderId = globalModels?.globalEmbeddingProviderId
      const embeddingModelId = globalModels?.globalEmbeddingModelId

      if (!embeddingProviderId || !embeddingModelId) {
        logger.warn('[MemorySearch] 嵌入模型未配置，降级为 FTS 搜索')
        const ftsResults = await runtime.hsRepo.queryFTS(query, options?.topK ?? 20, {
          vaultId: activeVaultId
        })
        return mapResults(ftsResults)
      }

      const embeddingProviderConfig = providers.find((p: any) => p.id === embeddingProviderId)
      if (!embeddingProviderConfig) {
        logger.warn('[MemorySearch] 嵌入供应商配置未找到，降级为 FTS 搜索')
        const ftsResults = await runtime.hsRepo.queryFTS(query, options?.topK ?? 20, {
          vaultId: activeVaultId
        })
        return mapResults(ftsResults)
      }

      const embeddingProvider = registry.getOrUpdateProvider(embeddingProviderConfig)
      const embAdapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, runtime.hsRepo)

      // 生成查询向量
      const queryVector = await embAdapter.embedQuery(query)
      if (!queryVector) {
        logger.warn('[MemorySearch] 查询向量生成失败，降级为 FTS 搜索')
        const ftsResults = await runtime.hsRepo.queryFTS(query, options?.topK ?? 20, {
          vaultId: activeVaultId
        })
        return mapResults(ftsResults)
      }

      // 执行混合搜索（FTS + 向量 RRF 融合）
      const topK = options?.topK ?? 20
      const minScore = options?.minScore ?? 0.3

      const results = await runtime.hybridSearchService.search({
        queryVector,
        queryText: query,
        topK,
        similarityThreshold: minScore,
        filter: { vaultId: activeVaultId }
      })

      return mapResults(results)
    } catch (e) {
      logger.error('[MemorySearch] RAG 搜索失败，降级为 FTS:', e as Error)
      const ftsResults = await runtime.hsRepo.queryFTS(query, options?.topK ?? 20, {
        vaultId: activeVaultId
      })
      return mapResults(ftsResults)
    }
  }
}
