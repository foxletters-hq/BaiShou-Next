import type { AIProviderConfig } from '../types/settings.types'

/** 表示「未配置」的模型/供应商占位值（与桌面 Agent 页 unknown / 设置页 off 对齐） */
export const UNCONFIGURED_DIALOGUE_MODEL_VALUES = new Set(['', 'unknown', 'off', 'default'])

/** 会话落库/UI 哨兵：显式表示未选择模型（非可用模型 ID） */
export const UNCONFIGURED_DIALOGUE_MODEL_SENTINEL = 'unknown'

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
  /** 用户在本轮/本会话手动选择的供应商与模型 */
  requestedProviderId?: string | null
  requestedModelId?: string | null
  globalDialogueProviderId?: string | null
  globalDialogueModelId?: string | null
  /**
   * 桌面模型选择器建议项（首个已启用供应商）；不参与权威解析链，
   * 仅作 UI 快捷填充，解析结果为 none 时不应伪造为已选模型。
   */
  fallbackProviderId?: string | null
  fallbackModelId?: string | null
}

export type DialogueModelSelectionSource =
  | 'assistant'
  | 'requested'
  | 'global'
  | 'fallback'
  | 'none'

export interface ResolvedDialogueModel {
  providerId: string | null
  modelId: string | null
  source: DialogueModelSelectionSource
}

/** 工作区/Agent 会话当前选择状态（可序列化到会话元数据） */
export interface AgentDialogueSelectionState {
  assistantId?: string | null
  providerId: string | null
  modelId: string | null
  modelSelectionSource: DialogueModelSelectionSource
}

export type AgentDialogueSelectionSwitchKind = 'model' | 'assistant'

export interface AgentDialogueSelectionSwitchEvent {
  kind: AgentDialogueSelectionSwitchKind
  sessionId?: string
  previous?: AgentDialogueSelectionState
  next: AgentDialogueSelectionState
  at: string
}

/**
 * 解析 Agent 对话模型（权威链）：
 * 伙伴专属 → 用户请求 → 全局默认 → none。
 * fallback 仅当显式传入且前序均为 none 时用于桌面选择器建议，流式发送不得依赖 fallback。
 */
export function resolveDialogueModelSelection(
  input: DialogueModelSelectionInput
): ResolvedDialogueModel {
  const {
    assistantProviderId,
    assistantModelId,
    requestedProviderId,
    requestedModelId,
    globalDialogueProviderId,
    globalDialogueModelId,
    fallbackProviderId,
    fallbackModelId
  } = input

  if (
    isConfiguredProviderId(assistantProviderId) &&
    isConfiguredDialogueModelId(assistantModelId)
  ) {
    return {
      providerId: assistantProviderId!.trim(),
      modelId: assistantModelId!.trim(),
      source: 'assistant'
    }
  }

  if (
    isConfiguredProviderId(requestedProviderId) &&
    isConfiguredDialogueModelId(requestedModelId)
  ) {
    return {
      providerId: requestedProviderId!.trim(),
      modelId: requestedModelId!.trim(),
      source: 'requested'
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

export function buildAgentDialogueSelectionState(params: {
  assistantId?: string | null
  resolved: ResolvedDialogueModel
}): AgentDialogueSelectionState {
  return {
    assistantId: params.assistantId ?? null,
    providerId: params.resolved.providerId,
    modelId: params.resolved.modelId,
    modelSelectionSource: params.resolved.source
  }
}

/** 检测助手/模型切换，用于轻量通知或会话元数据追加 */
export function detectDialogueSelectionSwitches(
  previous: AgentDialogueSelectionState | null | undefined,
  next: AgentDialogueSelectionState,
  sessionId?: string
): AgentDialogueSelectionSwitchEvent[] {
  const at = new Date().toISOString()
  const events: AgentDialogueSelectionSwitchEvent[] = []

  const prevAssistant = previous?.assistantId ?? null
  const nextAssistant = next.assistantId ?? null
  if (prevAssistant !== nextAssistant) {
    events.push({
      kind: 'assistant',
      sessionId,
      previous: previous ?? undefined,
      next,
      at
    })
  }

  const prevProvider = previous?.providerId ?? null
  const prevModel = previous?.modelId ?? null
  if (prevProvider !== next.providerId || prevModel !== next.modelId) {
    events.push({
      kind: 'model',
      sessionId,
      previous: previous ?? undefined,
      next,
      at
    })
  }

  return events
}

/** 将解析结果映射为会话存储字段（未配置时使用 unknown 哨兵，不伪造默认模型名） */
export function toStorageDialogueIds(resolved: ResolvedDialogueModel): {
  providerId: string
  modelId: string
} {
  return {
    providerId: resolved.providerId ?? UNCONFIGURED_DIALOGUE_MODEL_SENTINEL,
    modelId: resolved.modelId ?? UNCONFIGURED_DIALOGUE_MODEL_SENTINEL
  }
}

/** 从 ai_providers 列表推导桌面端模型选择器建议的首个可用供应商/模型 */
export function resolveProviderListDialogueFallback(
  providers: Pick<AIProviderConfig, 'id' | 'isEnabled' | 'enabledModels' | 'models'>[]
): { providerId: string | null; modelId: string | null } {
  const enabled = providers.filter((p) => p.isEnabled !== false)
  const candidate = enabled[0] ?? providers[0]
  if (!candidate) {
    return { providerId: null, modelId: null }
  }

  const modelId = pickFirstConfiguredModelFromProvider(candidate)
  return {
    providerId: candidate.id,
    modelId
  }
}

function pickFirstConfiguredModelFromProvider(
  provider: Pick<AIProviderConfig, 'enabledModels' | 'models'>
): string | null {
  for (const list of [provider.enabledModels, provider.models]) {
    if (!list?.length) continue
    for (const model of list) {
      if (isConfiguredDialogueModelId(model)) return model.trim()
    }
  }
  return null
}

/** 顶部模型名称展示；未配置时返回 null，由 UI 显示「暂未选择模型」 */
export function formatDialogueModelLabel(modelId: string | null | undefined): string | null {
  if (!isConfiguredDialogueModelId(modelId)) return null
  return modelId!.trim()
}

/** 按顺序取第一个已配置的 ID（模型/供应商均适用，跳过 unknown/off/default 等占位值） */
export function coalesceConfiguredId(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    if (isConfiguredDialogueModelId(candidate)) return candidate!.trim()
  }
  return null
}

/** 未配置可用对话模型时的标准错误文案（桌面 Agent / 工作区流式对话） */
export const DIALOGUE_MODEL_NOT_CONFIGURED_ERROR =
  '未配置对话模型。请在设置中配置默认对话模型 (Settings -> AI Config -> 默认模型)'

/** 流式对话：按权威链解析，均无效时返回 null（不伪造默认模型） */
export function resolveStreamDialogueModelSelection(
  input: DialogueModelSelectionInput
): ResolvedDialogueModel {
  return resolveDialogueModelSelection(input)
}

/** 流式对话等场景：仅合并模型 ID 候选（不含伙伴/供应商配对校验） */
export function resolveStreamDialogueModelId(
  ...candidates: (string | null | undefined)[]
): string | null {
  return coalesceConfiguredId(...candidates)
}

/** 流式对话必须存在已配置模型（权威链），否则抛出明确错误 */
export function requireResolvedDialogueModel(
  input: DialogueModelSelectionInput
): ResolvedDialogueModel & { providerId: string; modelId: string } {
  const resolved = resolveDialogueModelSelection(input)
  if (!resolved.providerId || !resolved.modelId) {
    throw new Error(DIALOGUE_MODEL_NOT_CONFIGURED_ERROR)
  }
  return resolved as ResolvedDialogueModel & { providerId: string; modelId: string }
}

/** @deprecated 优先使用 requireResolvedDialogueModel；仅模型 ID 粗合并 */
export function requireStreamDialogueModelId(
  ...candidates: (string | null | undefined)[]
): string {
  const modelId = resolveStreamDialogueModelId(...candidates)
  if (!modelId) {
    throw new Error(DIALOGUE_MODEL_NOT_CONFIGURED_ERROR)
  }
  return modelId
}
