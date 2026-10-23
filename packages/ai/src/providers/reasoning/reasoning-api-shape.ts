import { normalizeModelBaseId } from '@baishou/shared'
import {
  isOpenAiStyleReasoningModel,
  isAnthropicReasoningModel,
  isGeminiReasoningModel,
  isGlm52ReasoningModel,
  isMiniMaxM3Model,
  isDeepSeekV4Model,
  isKimiThinkingControlModel,
  isDashScopeThinkingToggleModel,
  isReasoningEffortBlacklistedModel,
  getReasoningControlForModel
} from '@baishou/shared'

export type ReasoningApiShape =
  | 'responses'
  | 'chat'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'none'

export type ReasoningApiShapeContext = {
  modelId: string
  providerType?: string
  baseUrl?: string
}

/** 一律走 chat completions + body 注入的兼容供应商（对齐参考：openai-compatible 族） */
const OPENAI_COMPAT_CHAT_PROVIDER_TYPES = new Set([
  'deepseek',
  'siliconflow',
  'dashscope',
  'zhipu',
  'ollama',
  'lmstudio',
  'custom',
  'opencodego',
  'doubao',
  'mistral',
  'stepfun',
  'hunyuan',
  'xiaomimimo',
  'vercel',
  'kimi',
  'grok',
  'minimax'
])

/**
 * 决定思考参数应走哪条 API / 方言。
 * 官方 OpenAI + Responses；其余兼容网关强制 chat（避免 @ai-sdk/openai 校验/错误路由）。
 */
export function resolveReasoningApiShape(ctx: ReasoningApiShapeContext): ReasoningApiShape {
  const modelId = ctx.modelId?.trim() || ''
  const type = (ctx.providerType || '').toLowerCase()
  const base = (ctx.baseUrl || '').toLowerCase()

  if (!modelId) return 'none'

  const control = getReasoningControlForModel(modelId, ctx.providerType)
  // Kimi 走 chat + budget_tokens 注入（自有预算上限）；通义 toggle 同样走 chat
  if (isKimiThinkingControlModel(modelId)) {
    return 'chat'
  }
  // toggle / budget（通义等）走 chat + fetch 注入
  if (control.supportsToggle || control.mode === 'toggle' || control.mode === 'budget') {
    if (type === 'anthropic' || (type === 'opencodego' && isAnthropicReasoningModel(modelId))) {
      // 非 Kimi 的 anthropic 仍走 anthropic shape
      if (!isKimiThinkingControlModel(modelId)) return 'anthropic'
    }
    return 'chat'
  }

  if (isReasoningEffortBlacklistedModel(modelId)) {
    if (type === 'dashscope' || isDashScopeThinkingToggleModel(modelId, ctx.providerType)) {
      return 'chat'
    }
    return 'none'
  }

  if (type === 'anthropic' || (type === 'opencodego' && isAnthropicReasoningModel(modelId))) {
    return 'anthropic'
  }

  if (type === 'openrouter') {
    return 'openrouter'
  }

  if (type === 'gemini' || type === 'vertexai') {
    return 'gemini'
  }
  // 模型名像 gemini 但挂在兼容商上：仍用 google options 仅当原生 gemini provider
  if (isGeminiReasoningModel(modelId) && (type === 'gemini' || type === 'vertexai' || !type)) {
    return 'gemini'
  }

  if (type === 'opencodego') {
    if (
      isOpenAiStyleReasoningModel(modelId) ||
      isDeepSeekV4Model(modelId) ||
      isKimiThinkingControlModel(modelId) ||
      isGlm52ReasoningModel(modelId) ||
      isMiniMaxM3Model(modelId)
    ) {
      return 'chat'
    }
    return 'none'
  }

  if (
    isDeepSeekV4Model(modelId) ||
    isGlm52ReasoningModel(modelId) ||
    isMiniMaxM3Model(modelId) ||
    isKimiThinkingControlModel(modelId) ||
    /grok-3-mini/.test(normalizeModelBaseId(modelId))
  ) {
    return 'chat'
  }

  if (OPENAI_COMPAT_CHAT_PROVIDER_TYPES.has(type)) {
    return 'chat'
  }

  if (type === 'dashscope') {
    return 'chat'
  }

  if (isOpenAiStyleReasoningModel(modelId)) {
    if (type === 'deepseek' || base.includes('deepseek')) return 'chat'
    if (type === 'ollama' || type === 'lmstudio') return 'chat'
    if (type === 'siliconflow' || type === 'dashscope' || type === 'zhipu') return 'chat'
    // 非官方 OpenAI 基址（代理 / OpenCode Go 被映射成 openai）一律 chat
    if (ctx.baseUrl && !isOfficialOpenAiBaseUrl(ctx.baseUrl)) return 'chat'
    if (type && type !== 'openai') return 'chat'
    return 'responses'
  }

  if (type === 'anthropic') return 'anthropic'
  if (type === 'gemini') return 'gemini'

  return 'none'
}

export function shouldUseOpenAiResponsesLanguageModel(ctx: ReasoningApiShapeContext): boolean {
  return resolveReasoningApiShape(ctx) === 'responses'
}

/**
 * Chat Completions 是否走 @ai-sdk/openai-compatible。
 * 官方 OpenAI（含 Responses）仍用 @ai-sdk/openai；其余兼容网关用 openai-compatible，
 * 以便 reasoningEffort 支持 max 等字符串档位，避免 openai 包枚举校验失败。
 */
export function shouldUseOpenAiCompatibleChatSdk(ctx: {
  providerType?: string
  baseUrl?: string
}): boolean {
  const type = (ctx.providerType || '').toLowerCase()
  if (!type || type === 'openai') {
    if (!ctx.baseUrl?.trim()) return false
    return !isOfficialOpenAiBaseUrl(ctx.baseUrl)
  }
  if (type === 'anthropic' || type === 'gemini' || type === 'vertexai') return false
  return true
}

export function isOfficialOpenAiBaseUrl(baseUrl?: string): boolean {
  if (!baseUrl?.trim()) return true
  const u = baseUrl.toLowerCase()
  return u.includes('api.openai.com')
}

export function modelBaseId(modelId: string): string {
  return normalizeModelBaseId(modelId)
}
