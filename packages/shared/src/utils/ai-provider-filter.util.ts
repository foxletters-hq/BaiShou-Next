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
 * 用户显式配置的启用模型列表。
 * `enabledModels: []` 表示全部关闭；仅当字段缺失时回退 `models`（兼容旧数据）。
 */
export function resolveEnabledModelPool(config: Pick<AIProviderConfig, 'enabledModels' | 'models'>): string[] {
  if (config.enabledModels !== undefined) {
    return config.enabledModels
  }
  return config.models ?? []
}

/**
 * 过滤可用于模型选择弹窗的供应商与模型列表。
 * 仅保留已启用的供应商，且模型须在用户启用的 enabledModels 中。
 */
export function filterProvidersForModelSwitcher(
  providers: AIProviderConfig[],
  mode: ModelSwitcherFilterMode = 'dialogue'
): ModelSwitcherProvider[] {
  return providers
    .filter((p) => p.isEnabled)
    .map((p) => {
      const pool = resolveEnabledModelPool(p)
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
