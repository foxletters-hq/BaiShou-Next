import type { AIProviderConfig } from '../types/settings.types'

/** 表示「未配置」的模型/供应商占位值（与桌面 Agent 页 unknown / 设置页 off 对齐） */
export const UNCONFIGURED_DIALOGUE_MODEL_VALUES = new Set([
  '',
  'unknown',
  'off',
  'default'
])

export function isConfiguredDialogueModelId(modelId: string | null | undefined): boolean {
  if (modelId == null) return false
  const trimmed = modelId.trim()
  if (!trimmed) return false
  return !UNCONFIGURED_DIALOGUE_MODEL_VALUES.has(trimmed)
}

export function isConfiguredProviderId(providerId: string | null | undefined): boolean {
  return isConfiguredDialogueModelId(providerId)
}

export interface DialogueModelSelectionInput {
  assistantProviderId?: string | null
  assistantModelId?: string | null
  globalDialogueProviderId?: string | null
  globalDialogueModelId?: string | null
  /** 桌面端：首个已启用供应商及其模型（移动端对话 UI 默认不使用） */
  fallbackProviderId?: string | null
  fallbackModelId?: string | null
}

export type DialogueModelSelectionSource = 'assistant' | 'global' | 'fallback' | 'none'

export interface ResolvedDialogueModel {
  providerId: string | null
  modelId: string | null
  source: DialogueModelSelectionSource
}

/**
 * 解析 Agent 对话模型：伙伴专属 → 全局默认对话模型 →（可选）首个已启用供应商。
 * 移动端 UI/发送消息仅使用前两级；桌面 useModelSelection 可传入 fallback。
 */
export function resolveDialogueModelSelection(
  input: DialogueModelSelectionInput
): ResolvedDialogueModel {
  const {
    assistantProviderId,
    assistantModelId,
    globalDialogueProviderId,
    globalDialogueModelId,
    fallbackProviderId,
    fallbackModelId
  } = input

  if (isConfiguredProviderId(assistantProviderId) && isConfiguredDialogueModelId(assistantModelId)) {
    return {
      providerId: assistantProviderId!.trim(),
      modelId: assistantModelId!.trim(),
      source: 'assistant'
    }
  }

  if (
    isConfiguredProviderId(globalDialogueProviderId) &&
    isConfiguredDialogueModelId(globalDialogueModelId)
  ) {
    return {
      providerId: globalDialogueProviderId!.trim(),
      modelId: globalDialogueModelId!.trim(),
      source: 'global'
    }
  }

  if (isConfiguredProviderId(fallbackProviderId) && isConfiguredDialogueModelId(fallbackModelId)) {
    return {
      providerId: fallbackProviderId!.trim(),
      modelId: fallbackModelId!.trim(),
      source: 'fallback'
    }
  }

  return { providerId: null, modelId: null, source: 'none' }
}

/** 从 ai_providers 列表推导桌面端使用的首个可用供应商/模型 */
export function resolveProviderListDialogueFallback(
  providers: Pick<AIProviderConfig, 'id' | 'isEnabled' | 'enabledModels' | 'models'>[]
): { providerId: string | null; modelId: string | null } {
  const enabled = providers.filter((p) => p.isEnabled !== false)
  const candidate = enabled[0] ?? providers[0]
  if (!candidate) {
    return { providerId: null, modelId: null }
  }

  const modelId = candidate.enabledModels?.[0] ?? candidate.models?.[0] ?? null
  return {
    providerId: candidate.id,
    modelId: isConfiguredDialogueModelId(modelId) ? modelId : null
  }
}

/** 顶部模型名称展示；未配置时返回 null，由 UI 显示「暂未选择模型」 */
export function formatDialogueModelLabel(modelId: string | null | undefined): string | null {
  if (!isConfiguredDialogueModelId(modelId)) return null
  return modelId!.trim()
}
