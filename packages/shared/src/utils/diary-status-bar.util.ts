import { DEFAULT_USER_PROFILE } from '../constants/user-profile.constants'
import type { GlobalModelsConfig, RagConfig } from '../types/settings.types'
import { isConfiguredDialogueModelId, isConfiguredProviderId } from './agent-dialogue-model.util'
import { isRagMemoryEnabled } from './rag-embed-failure.util'

/** 默认昵称不算已配置自称 */
export function isDefaultGraphSelfName(nickname: string | null | undefined): boolean {
  const name = nickname?.trim()
  if (!name) return true
  return name === DEFAULT_USER_PROFILE.nickname
}

/**
 * 图谱自称是否已配置：标记为 true，且昵称非空、非默认「白守用户」。
 */
export function isGraphSelfNameConfigured(
  flag: boolean | null | undefined,
  nickname: string | null | undefined
): boolean {
  if (flag !== true) return false
  const name = nickname?.trim()
  if (!name) return false
  return !isDefaultGraphSelfName(name)
}

/** 对话/图谱模型是否已显式配置（不含 resolve 时的 deepseek-chat 回落） */
export function hasGraphModelConfigured(
  models: Partial<GlobalModelsConfig> | null | undefined
): boolean {
  return (
    isConfiguredProviderId(models?.globalDialogueProviderId) &&
    isConfiguredDialogueModelId(models?.globalDialogueModelId)
  )
}

export function isGraphFeatureConfigured(opts: {
  selfNameConfigured: boolean
  hasGraphModel: boolean
}): boolean {
  return opts.selfNameConfigured && opts.hasGraphModel
}

/** 待嵌入能力：RAG 记忆开启且 embedding 供应商+模型已配置 */
export function isRagEmbedFeatureConfigured(opts: {
  ragConfig?: Pick<RagConfig, 'ragEnabled'> | null
  globalModels?: Partial<GlobalModelsConfig> | null
}): boolean {
  if (!isRagMemoryEnabled(opts.ragConfig)) return false
  const providerId = opts.globalModels?.globalEmbeddingProviderId
  const modelId = opts.globalModels?.globalEmbeddingModelId
  return isConfiguredProviderId(providerId) && isConfiguredDialogueModelId(modelId)
}

export function shouldShowPendingExtract(opts: {
  graphConfigured: boolean
  count: number
}): boolean {
  return opts.graphConfigured && opts.count > 0
}

export function shouldShowPendingEmbed(opts: { ragConfigured: boolean; count: number }): boolean {
  return opts.ragConfigured && opts.count > 0
}

/** 已配置时返回可用于抽取的自称，否则 null */
export function resolveGraphExtractSelfName(
  flag: boolean | null | undefined,
  nickname: string | null | undefined
): string | null {
  if (!isGraphSelfNameConfigured(flag, nickname)) return null
  return nickname!.trim()
}
