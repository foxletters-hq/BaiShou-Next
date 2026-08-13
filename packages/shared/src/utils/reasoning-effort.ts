import { normalizeModelBaseId } from './provider-vision-models'
import { isOpenAiStyleReasoningModel } from './model-capabilities'

/** 统一思考档位（UX）；按模型裁剪后再映射为各厂原生字段 */
export const REASONING_EFFORTS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max'
] as const

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number]

/** 设置项：auto = 不显式传 effort，交给模型/SDK 默认 */
export type ReasoningEffortSetting = ReasoningEffort | 'auto'

export const WIDELY_SUPPORTED_EFFORTS: ReasoningEffort[] = ['low', 'medium', 'high']

export const OPENAI_BASE_EFFORTS: ReasoningEffort[] = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh'
]

/** 思考预算预设（按模型 max 裁剪） */
export const REASONING_BUDGET_PRESETS = [4000, 8000, 16000, 32000] as const

export type ReasoningControlMode = 'effort' | 'toggle' | 'budget' | 'none'

export type ReasoningControl = {
  mode: ReasoningControlMode
  /** 可与 mode 并存：如 Kimi = toggle + budget */
  supportsToggle?: boolean
  supportsBudget?: boolean
  efforts?: ReasoningEffort[]
  maxBudgetTokens?: number
}

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return typeof value === 'string' && (REASONING_EFFORTS as readonly string[]).includes(value)
}

export function normalizeReasoningEffortSetting(value: unknown): ReasoningEffortSetting {
  if (value === 'auto' || value == null || value === '') return 'auto'
  if (isReasoningEffort(value)) return value
  return 'auto'
}

/**
 * 思考档位展示文案：固定英文，不做 i18n。
 * auto → Default；其余用档位 id（none / low / medium / high / …）。
 */
export function formatReasoningEffortLabel(
  effort: ReasoningEffortSetting | string | null | undefined
): string {
  const normalized = normalizeReasoningEffortSetting(effort)
  if (normalized === 'auto') return 'Default'
  return normalized
}

/** 设置/会话覆盖解析为实际档位；auto 时用 fallback（默认 medium） */
export function resolveEffectiveReasoningEffort(
  setting: ReasoningEffortSetting | undefined,
  fallback: ReasoningEffort = 'medium'
): ReasoningEffort | undefined {
  const normalized = normalizeReasoningEffortSetting(setting)
  if (normalized === 'auto') return fallback
  return normalized
}

export function isDeepSeekV4Model(modelId: string): boolean {
  const id = normalizeModelBaseId(modelId)
  return Boolean(id && id.includes('deepseek-v4'))
}

/** Kimi / Moonshot 可配思考（开关 + 预算）的模型族 */
export function isKimiThinkingControlModel(modelId: string): boolean {
  const id = normalizeModelBaseId(modelId)
  if (!id) return false
  if (/kimi-k2/.test(id) || /kimi-k3/.test(id)) return true
  if (/moonshot/.test(id) && /k2|k3|thinking/.test(id)) return true
  if (/^kimi/.test(id) && /thinking|k2|k3/.test(id)) return true
  return false
}

export function isDashScopeThinkingToggleModel(
  modelId: string,
  providerTypeOrId?: string
): boolean {
  const type = (providerTypeOrId || '').toLowerCase()
  if (type !== 'dashscope' && !type.includes('dashscope')) return false
  const id = normalizeModelBaseId(modelId)
  return Boolean(id && /qwen|thinking|reasoner|qwq/.test(id))
}

/**
 * 无 effort 档位 UI 的模型族（靠协议自带思考 / interleaved reasoning）。
 * 旧 DeepSeek、多数 Qwen/旧 GLM、非可控 Kimi、非 M3 MiniMax。
 * DeepSeek V4、Kimi thinking 控制模型不在此列。
 */
export function isReasoningEffortBlacklistedModel(modelId: string): boolean {
  const id = normalizeModelBaseId(modelId)
  if (!id) return false
  if (isDeepSeekV4Model(modelId)) return false
  if (isKimiThinkingControlModel(modelId)) return false
  if (
    id.includes('deepseek-chat') ||
    id.includes('deepseek-reasoner') ||
    id.includes('deepseek-r1') ||
    id.includes('deepseek-v3') ||
    /^deepseek/.test(id)
  ) {
    return true
  }
  if (/^qwen/.test(id) && !/thinking/.test(id)) return true
  if (/^glm/.test(id) && !/^glm-5\.2/.test(id)) return true
  if (/^(kimi|moonshot|k2p)/.test(id) && !/thinking/.test(id)) return true
  if (/^minimax/.test(id) && !/m3/.test(id)) return true
  return false
}

/** DeepSeek V4：对齐参考实现 — low/medium/high + max */
export function listDeepSeekReasoningEfforts(modelId: string): ReasoningEffort[] {
  if (!isDeepSeekV4Model(modelId)) return []
  return ['low', 'medium', 'high', 'max']
}

export function isAnthropicReasoningModel(modelId: string): boolean {
  const id = normalizeModelBaseId(modelId)
  return Boolean(id && (id.includes('claude') || id.startsWith('anthropic')))
}

export function isGeminiReasoningModel(modelId: string): boolean {
  const id = normalizeModelBaseId(modelId)
  if (!id) return false
  return id.includes('gemini-2.5') || id.includes('gemini-3') || /gemini.*thinking/.test(id)
}

export function isGlm52ReasoningModel(modelId: string): boolean {
  return /^glm-5\.2/.test(normalizeModelBaseId(modelId))
}

export function isMiniMaxM3Model(modelId: string): boolean {
  const id = normalizeModelBaseId(modelId)
  return id.includes('minimax') && id.includes('m3')
}

/** OpenAI 系模型可用档位（按模型族裁剪；对齐官方 reasoning.effort 支持表） */
export function listOpenAiStyleReasoningEfforts(modelId: string): ReasoningEffort[] {
  const id = normalizeModelBaseId(modelId)
  if (!id || !isOpenAiStyleReasoningModel(modelId)) return []

  // chat 变体非推理（双保险；主判定已在 isOpenAiStyleReasoningModel）
  if (/^gpt-5(?:\.\d+(?:\.\d+)*)?-chat/.test(id)) return []

  if (id.includes('deep-research')) return ['medium']

  // Pro：gpt-5-pro 仅 high；gpt-5.x-pro 为 medium|high|xhigh
  if (id.includes('pro') && id.startsWith('gpt-5')) {
    if (/gpt-5\.\d+-pro/.test(id)) return ['medium', 'high', 'xhigh']
    return ['high']
  }

  // Codex：无 none；5.1 普通 Codex 无 xhigh，其后含 xhigh
  if (id.includes('codex')) {
    if (/gpt-5\.1/.test(id) && !/codex-max/.test(id)) {
      return ['low', 'medium', 'high']
    }
    return ['low', 'medium', 'high', 'xhigh']
  }

  // GPT-5.6：none|low|medium|high|xhigh|max
  if (/^gpt-5\.6/.test(id)) {
    return ['none', 'low', 'medium', 'high', 'xhigh', 'max']
  }

  // GPT-5.2+（含 5.4/5.5 等）：none|low|medium|high|xhigh
  if (/^gpt-5\.[2-9]/.test(id) || /^gpt-5\.\d{2}/.test(id)) {
    return ['none', 'low', 'medium', 'high', 'xhigh']
  }

  // GPT-5.1：none|low|medium|high
  if (id.startsWith('gpt-5.1')) return ['none', 'low', 'medium', 'high']

  // GPT-5 / mini / nano：minimal|low|medium|high
  if (id.startsWith('gpt-5')) {
    return ['minimal', 'low', 'medium', 'high']
  }

  // o 系列：low|medium|high
  if (/^o[1-4]/.test(id)) return ['low', 'medium', 'high']

  return ['low', 'medium', 'high']
}

export function listAnthropicReasoningEfforts(modelId: string): ReasoningEffort[] {
  const id = normalizeModelBaseId(modelId)
  if (!id) return []
  // Opus 4.7+ / Sonnet 5 等：含 xhigh
  if (
    /claude.*4[.-][7-9]|claude.*4[.-]\d{2}|opus-4[.-][7-9]|sonnet-4[.-][7-9]|sonnet-5|opus-5|claude.*sonnet-5|claude.*opus-5/.test(
      id
    )
  ) {
    return ['low', 'medium', 'high', 'xhigh', 'max']
  }
  // Claude 4.6 系：low|medium|high|max
  if (/claude.*4[.-]6|opus-4[.-]6|sonnet-4[.-]6/.test(id)) {
    return ['low', 'medium', 'high', 'max']
  }
  // Opus 4.5：low|medium|high（无 max）
  if (/opus-4[.-]5|claude.*opus.*4[.-]5/.test(id)) {
    return ['low', 'medium', 'high']
  }
  // 其它支持 effort 的 Claude：保守 high|max
  if (id.includes('claude')) return ['high', 'max']
  return []
}

export function listGeminiReasoningEfforts(modelId: string): ReasoningEffort[] {
  const id = normalizeModelBaseId(modelId)
  if (!id) return []
  // 2.5：官方为 thinkingBudget；UI 用 high/max 映射两档预算
  if (id.includes('gemini-2.5')) return ['high', 'max']
  if (id.includes('flash-image')) return ['minimal', 'high']
  if (id.includes('pro-image')) return ['high']
  // Gemini 3 Flash：minimal|low|medium|high
  if (id.includes('gemini-3') && id.includes('flash')) {
    return ['minimal', 'low', 'medium', 'high']
  }
  // gemini-3-pro（非 3.1）：low|high；3.1-pro：low|medium|high
  if (id.includes('gemini-3') && id.includes('pro')) {
    if (/gemini-3\.1|gemini-3-1/.test(id)) return ['low', 'medium', 'high']
    return ['low', 'high']
  }
  if (id.includes('gemini-3')) return ['low', 'medium', 'high']
  return []
}

function listEffortModeEfforts(
  modelId: string,
  providerTypeOrId?: string
): ReasoningEffort[] | null {
  const type = (providerTypeOrId || '').toLowerCase()
  if (isDeepSeekV4Model(modelId)) return listDeepSeekReasoningEfforts(modelId)
  if (type.includes('anthropic') || modelId.includes('claude')) {
    const list = listAnthropicReasoningEfforts(modelId)
    return list.length > 0 ? list : null
  }
  if (type.includes('gemini') || type.includes('vertex') || modelId.includes('gemini')) {
    const list = listGeminiReasoningEfforts(modelId)
    return list.length > 0 ? list : null
  }
  if (isGlm52ReasoningModel(modelId)) {
    // OpenRouter 将 xhigh 映射为 GLM-5.2 原生 max
    if (type === 'openrouter') return ['high', 'xhigh']
    return ['high', 'max']
  }
  if (isMiniMaxM3Model(modelId)) return ['none', 'high']
  if (
    (type === 'grok' || type === 'openrouter' || type === 'custom' || !type) &&
    /grok-3-mini/.test(normalizeModelBaseId(modelId))
  ) {
    return ['low', 'high']
  }
  if (type === 'openrouter') {
    if (isOpenAiStyleReasoningModel(modelId)) {
      const list = listOpenAiStyleReasoningEfforts(modelId)
      return list.length > 0 ? list : [...WIDELY_SUPPORTED_EFFORTS]
    }
    if (isGeminiReasoningModel(modelId)) return listGeminiReasoningEfforts(modelId)
    if (isAnthropicReasoningModel(modelId)) return listAnthropicReasoningEfforts(modelId)
    if (isDeepSeekV4Model(modelId)) return listDeepSeekReasoningEfforts(modelId)
    return [...WIDELY_SUPPORTED_EFFORTS]
  }
  const openaiEfforts = listOpenAiStyleReasoningEfforts(modelId)
  if (openaiEfforts.length > 0) return openaiEfforts
  return null
}

/**
 * 统一思考控制能力（UI + 请求侧共用）。
 * mode=none 时右栏仅展示 Default。
 */
export function getReasoningControlForModel(
  modelId: string,
  providerTypeOrId?: string
): ReasoningControl {
  if (!modelId?.trim()) return { mode: 'none' }

  const type = (providerTypeOrId || '').toLowerCase()

  if (isKimiThinkingControlModel(modelId)) {
    return {
      mode: 'toggle',
      supportsToggle: true,
      supportsBudget: true,
      maxBudgetTokens: 81920
    }
  }

  if (isDashScopeThinkingToggleModel(modelId, providerTypeOrId)) {
    return { mode: 'toggle', supportsToggle: true }
  }

  const efforts = listEffortModeEfforts(modelId, providerTypeOrId)
  if (efforts && efforts.length > 0) {
    // 还需通过 capable 门槛（避免误开）
    if (isReasoningCapableModel(modelId, providerTypeOrId)) {
      return { mode: 'effort', efforts }
    }
  }

  if (type === 'dashscope' && /qwen|thinking|reasoner/.test(normalizeModelBaseId(modelId))) {
    return { mode: 'toggle', supportsToggle: true }
  }

  return { mode: 'none' }
}

/** 当前模型可选思考档位；不支持 effort 时返回 null */
export function listReasoningEffortsForModel(
  modelId: string,
  providerTypeOrId?: string
): ReasoningEffort[] | null {
  const control = getReasoningControlForModel(modelId, providerTypeOrId)
  if (control.mode !== 'effort' || !control.efforts?.length) return null
  return control.efforts
}

/** 模型是否具备可配置思考能力（effort / toggle / budget） */
export function isReasoningCapableModel(modelId: string, providerType?: string): boolean {
  if (!modelId) return false
  const type = (providerType || '').toLowerCase()
  if (isDeepSeekV4Model(modelId)) return true
  if (isKimiThinkingControlModel(modelId)) return true
  if (isDashScopeThinkingToggleModel(modelId, providerType)) return true
  if (isReasoningEffortBlacklistedModel(modelId)) {
    if (type === 'dashscope') return true
    return false
  }
  if (isOpenAiStyleReasoningModel(modelId)) return true
  if (type === 'anthropic' || isAnthropicReasoningModel(modelId)) return true
  if (type === 'gemini' || type === 'vertexai' || isGeminiReasoningModel(modelId)) return true
  if (
    type === 'openrouter' &&
    (isGeminiReasoningModel(modelId) || isOpenAiStyleReasoningModel(modelId))
  ) {
    return true
  }
  if (isGlm52ReasoningModel(modelId)) return true
  if (isMiniMaxM3Model(modelId)) return true
  if (type === 'dashscope' && /qwen|thinking|reasoner/.test(normalizeModelBaseId(modelId))) {
    return true
  }
  if (/grok-3-mini/.test(normalizeModelBaseId(modelId))) return true
  return false
}

/** 按上限裁剪预算预设 */
export function listReasoningBudgetPresets(maxBudgetTokens?: number): number[] {
  const max = maxBudgetTokens && maxBudgetTokens > 0 ? maxBudgetTokens : 32000
  const presets = REASONING_BUDGET_PRESETS.filter((n) => n <= max)
  if (presets.length === 0) return [Math.min(4000, max)]
  if (!presets.includes(max) && max > presets[presets.length - 1]!) {
    return [...presets, max]
  }
  return [...presets]
}

export function normalizeReasoningBudgetTokens(
  value: unknown,
  maxBudgetTokens?: number
): number | undefined {
  if (value == null || value === '' || value === 'auto') return undefined
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return undefined
  const capped = maxBudgetTokens && maxBudgetTokens > 0 ? Math.min(n, maxBudgetTokens) : n
  return Math.floor(capped)
}

/** 从可用档位中取最弱档（探活/小任务） */
export function pickWeakestReasoningEffort(efforts: ReasoningEffort[]): ReasoningEffort | undefined {
  if (efforts.length === 0) return undefined
  const order: ReasoningEffort[] = [
    'none',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
    'max'
  ]
  for (const e of order) {
    if (efforts.includes(e)) return e
  }
  return efforts[0]
}
