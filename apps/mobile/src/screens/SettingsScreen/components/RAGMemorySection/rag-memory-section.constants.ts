import type { MockAiProviderModel, RagConfig } from '@baishou/ui/native'
import {
  AIProviderConfig,
  MOBILE_DEFAULT_BATCH_EMBED_CONCURRENCY,
  resolveMobileBatchEmbedConcurrency,
  filterProvidersForModelSwitcher
} from '@baishou/shared'

export const DEFAULT_RAG_CONFIG: RagConfig = {
  ragEnabled: true,
  ragTopK: 20,
  ragSimilarityThreshold: 0.4,
  batchEmbedConcurrency: MOBILE_DEFAULT_BATCH_EMBED_CONCURRENCY
}

/** 持久化/迁移可能把数值存成字符串，统一兜底，避免下游 toFixed 等数值方法崩溃 */
function coerceNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function clampMobileRagConfig(config: RagConfig): RagConfig {
  return {
    ...config,
    ragTopK: coerceNumber(config.ragTopK, DEFAULT_RAG_CONFIG.ragTopK),
    ragSimilarityThreshold: coerceNumber(
      config.ragSimilarityThreshold,
      DEFAULT_RAG_CONFIG.ragSimilarityThreshold
    ),
    batchEmbedConcurrency: resolveMobileBatchEmbedConcurrency(config.batchEmbedConcurrency)
  }
}

export type PromptMode = 'manual' | 'edit' | 'clear' | null

export function buildEmbeddingProviders(providers: AIProviderConfig[]): MockAiProviderModel[] {
  return filterProvidersForModelSwitcher(providers, 'embedding')
}
