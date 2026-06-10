import type { AIProviderConfig } from '../types/settings.types'
import { isEmbeddingModel, isTtsModel } from './embedding.utils'

export interface ModelSwitcherProvider {
  id: string
  name: string
  type?: string
  enabledModels?: string[]
  models?: string[]
}

export type ModelSwitcherFilterMode = 'dialogue' | 'embedding' | 'tts'

/**
 * 过滤可用于模型选择弹窗的供应商与模型列表。
 * 仅保留已启用的供应商，且模型须在 enabledModels（或 models 回退）中。
 */
export function filterProvidersForModelSwitcher(
  providers: AIProviderConfig[],
  mode: ModelSwitcherFilterMode = 'dialogue'
): ModelSwitcherProvider[] {
  return providers
    .filter((p) => p.isEnabled && (p.enabledModels?.length || p.models?.length))
    .map((p) => {
      const pool = p.enabledModels?.length ? p.enabledModels : p.models || []
      const filtered = pool.filter((modelId) => {
        const isEmbed = isEmbeddingModel(modelId)
        const isTts = isTtsModel(modelId)
        if (mode === 'embedding') return isEmbed
        if (mode === 'tts') return isTts
        return !isEmbed && !isTts
      })
      return {
        id: p.id,
        name: p.name || p.id,
        type: p.type,
        enabledModels: filtered,
        models: filtered
      }
    })
    .filter((p) => (p.enabledModels?.length ?? 0) > 0)
}
