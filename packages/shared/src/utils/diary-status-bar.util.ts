import { DEFAULT_USER_PROFILE } from '../constants/user-profile.constants'
import type { GlobalModelsConfig, RagConfig } from '../types/settings.types'
import { isConfiguredDialogueModelId } from './agent-dialogue-model.util'
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

/**
 * 对话模型是否足以驱动图谱抽取。
 * 只要显式配置了 modelId（非 off/unknown）即可；provider 可缺省由运行时解析。
 */
export function hasGraphModelConfigured(
  models: Partial<GlobalModelsConfig> | null | undefined
): boolean {
  return isConfiguredDialogueModelId(models?.globalDialogueModelId)
}

export function isGraphFeatureConfigured(opts: {
  selfNameConfigured: boolean
  hasGraphModel: boolean
}): boolean {
  return opts.selfNameConfigured && opts.hasGraphModel
}

/**
 * 底栏「待抽取」就绪：仅要求对话模型已配。
 * 自称未配时仍显示数量，点击进图谱页再引导填写。
 */
export function isGraphStatusBarReady(opts: { hasGraphModel: boolean }): boolean {
  return opts.hasGraphModel
}

/** 待嵌入底栏：伙伴记忆开启即可展示（无嵌入模型时仍可引导去设置） */
export function isRagEmbedFeatureConfigured(opts: {
  ragConfig?: Pick<RagConfig, 'ragEnabled'> | null
  /** @deprecated 底栏展示不再要求嵌入模型已配；保留参数兼容调用方 */
  globalModels?: Partial<GlobalModelsConfig> | null
}): boolean {
  void opts.globalModels
  return isRagMemoryEnabled(opts.ragConfig)
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
