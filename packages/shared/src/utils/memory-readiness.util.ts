import type { GlobalModelsConfig, RagConfig } from '../types/settings.types'
import { hasGraphModelConfigured } from './diary-status-bar.util'
import { resolveGlobalGraphModelIds } from './global-graph-model.util'
import { isRagMemoryEnabled } from './rag-embed-failure.util'

export type MemoryReadinessRowId = 'embedding' | 'extract' | 'vector' | 'graph'
export type MemoryReadinessState = 'ready' | 'missing' | 'blocked' | 'pending'

export type MemoryReadinessInput = {
  globalModels: Partial<GlobalModelsConfig> | null
  ragConfig: Pick<RagConfig, 'ragEnabled'> | null
  unindexedDiaryCount: number
  pendingGraphCount: number
}

export type MemoryReadinessRow = {
  id: MemoryReadinessRowId
  state: MemoryReadinessState
  /** 就绪时为模型名或空字符串；待办时为数量 */
  count?: number
  modelId?: string
}

function isEmbeddingModelConfigured(
  models: Partial<GlobalModelsConfig> | null | undefined
): boolean {
  const id = models?.globalEmbeddingModelId?.trim()
  if (!id) return false
  return id !== 'off' && id !== 'unknown'
}

function nonNegativeCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function buildMemoryReadinessRows(input: MemoryReadinessInput): MemoryReadinessRow[] {
  const embeddingConfigured = isEmbeddingModelConfigured(input.globalModels)
  const extractConfigured = hasGraphModelConfigured(input.globalModels)
  const extractIds = resolveGlobalGraphModelIds(input.globalModels)
  const ragEnabled = isRagMemoryEnabled(input.ragConfig)
  const unindexed = nonNegativeCount(input.unindexedDiaryCount)
  const pendingGraph = nonNegativeCount(input.pendingGraphCount)
  const embeddingModelId = input.globalModels?.globalEmbeddingModelId?.trim() || undefined

  const embedding: MemoryReadinessRow = embeddingConfigured
    ? { id: 'embedding', state: 'ready', modelId: embeddingModelId }
    : { id: 'embedding', state: 'missing' }

  const extract: MemoryReadinessRow = extractConfigured
    ? { id: 'extract', state: 'ready', modelId: extractIds.modelId }
    : { id: 'extract', state: 'missing', modelId: extractIds.modelId }

  const vector: MemoryReadinessRow =
    !embeddingConfigured || !ragEnabled
      ? { id: 'vector', state: 'blocked', count: unindexed }
      : unindexed > 0
        ? { id: 'vector', state: 'pending', count: unindexed }
        : { id: 'vector', state: 'ready', count: 0 }

  const graph: MemoryReadinessRow = !embeddingConfigured
    ? { id: 'graph', state: 'blocked', count: pendingGraph }
    : pendingGraph > 0
      ? { id: 'graph', state: 'pending', count: pendingGraph }
      : { id: 'graph', state: 'ready', count: 0 }

  return [embedding, extract, vector, graph]
}

export function isEmbeddingConfiguredForMemory(
  models: Partial<GlobalModelsConfig> | null | undefined
): boolean {
  return isEmbeddingModelConfigured(models)
}
