import type { ModelMessage, SystemModelMessage } from 'ai'
import type { CachingStrategyResult, PromptCachingContext } from './prompt-caching.types'

/** Anthropic / Bedrock 单请求最多 4 个 cache 断点 */
export const ANTHROPIC_BREAKPOINT_CAP = 4

/**
 * 多厂商 inline cache 标记 — 同时注入各 SDK 命名空间，由实际 Provider 读取对应键。
 */
export const INLINE_CACHE_PROVIDER_OPTIONS: Record<string, Record<string, unknown>> = {
  anthropic: { cacheControl: { type: 'ephemeral' } },
  openrouter: { cacheControl: { type: 'ephemeral' } },
  bedrock: { cachePoint: { type: 'default' } },
  openaiCompatible: { cache_control: { type: 'ephemeral' } },
  alibaba: { cacheControl: { type: 'ephemeral' } }
}

const CLAUDE_MODEL_RE = /claude|anthropic/i

export function isClaudeModel(modelId?: string | null): boolean {
  if (!modelId) return false
  return CLAUDE_MODEL_RE.test(modelId)
}

export function normalizePromptCacheKey(sessionId: string): string {
  const trimmed = sessionId.replace(/^ses_/, '').trim()
  if (!trimmed) return sessionId
  return trimmed.length > 64 ? trimmed.slice(0, 64) : trimmed
}

export function resolveCachingStrategy(ctx: PromptCachingContext): CachingStrategyResult {
  if (ctx.cachePolicy === 'none') {
    return { inlineMarkers: false, promptCacheKey: false }
  }

  const type = (ctx.providerType || 'openai').toLowerCase()
  const model = ctx.modelId || ''

  if (type === 'anthropic') {
    return { inlineMarkers: true, promptCacheKey: false }
  }

  if (type === 'gemini') {
    return { inlineMarkers: false, promptCacheKey: false }
  }

  if (type === 'vertexai') {
    if (isClaudeModel(model)) {
      return { inlineMarkers: true, promptCacheKey: false }
    }
    return { inlineMarkers: false, promptCacheKey: false }
  }

  if (isClaudeModel(model)) {
    return { inlineMarkers: true, promptCacheKey: Boolean(ctx.sessionId) }
  }

  return { inlineMarkers: false, promptCacheKey: Boolean(ctx.sessionId) }
}

export function mergeProviderOptions(
  existing: Record<string, unknown> | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...(existing ?? {}) }
  for (const [key, value] of Object.entries(patch)) {
    const prev = result[key]
    if (prev && typeof prev === 'object' && !Array.isArray(prev) && typeof value === 'object') {
      result[key] = { ...(prev as Record<string, unknown>), ...(value as Record<string, unknown>) }
    } else {
      result[key] = value
    }
  }
  return result
}

function hasInlineCacheMarker(providerOptions: Record<string, unknown> | undefined): boolean {
  if (!providerOptions) return false
  return Object.keys(INLINE_CACHE_PROVIDER_OPTIONS).some((key) => key in providerOptions)
}

function useMessageLevelCacheOptions(ctx: PromptCachingContext): boolean {
  const type = (ctx.providerType || '').toLowerCase()
  return type === 'anthropic' || (type === 'vertexai' && isClaudeModel(ctx.modelId))
}

function markMessageWithCache(
  msg: ModelMessage,
  ctx: PromptCachingContext
): ModelMessage {
  const existing = (msg as { providerOptions?: Record<string, unknown> }).providerOptions
  if (hasInlineCacheMarker(existing)) return msg

  if (useMessageLevelCacheOptions(ctx)) {
    return {
      ...msg,
      providerOptions: mergeProviderOptions(existing, INLINE_CACHE_PROVIDER_OPTIONS)
    } as ModelMessage
  }

  const content = (msg as { content?: unknown }).content
  if (!Array.isArray(content) || content.length === 0) {
    return {
      ...msg,
      providerOptions: mergeProviderOptions(existing, INLINE_CACHE_PROVIDER_OPTIONS)
    } as ModelMessage
  }

  const lastIdx = content.length - 1
  const nextContent = content.map((part, i) => {
    if (i !== lastIdx) return part
    if (
      typeof part === 'object' &&
      part !== null &&
      'type' in part &&
      ((part as { type?: string }).type === 'tool-approval-request' ||
        (part as { type?: string }).type === 'tool-approval-response')
    ) {
      return part
    }
    const partOpts = (part as { providerOptions?: Record<string, unknown> }).providerOptions
    if (hasInlineCacheMarker(partOpts)) return part
    return {
      ...part,
      providerOptions: mergeProviderOptions(partOpts, INLINE_CACHE_PROVIDER_OPTIONS)
    }
  })

  return { ...msg, content: nextContent } as ModelMessage
}

function lastIndexOfRole(messages: ModelMessage[], role: ModelMessage['role']): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === role) return i
  }
  return -1
}

/**
 * 按 agent 循环最优策略注入断点：system（若内嵌于 messages）→ 最新 user 消息。
 * tools 断点在 applyInlineCacheMarkersToTools 中处理。
 */
export function applyInlineCacheMarkersToMessages(
  messages: ModelMessage[],
  ctx: PromptCachingContext,
  breakpointBudget: { remaining: number }
): ModelMessage[] {
  if (messages.length === 0 || breakpointBudget.remaining <= 0) return messages

  let next = messages

  const systemIdx = messages.findIndex((m) => m.role === 'system')
  if (systemIdx >= 0 && breakpointBudget.remaining > 0) {
    const marked = markMessageWithCache(messages[systemIdx]!, ctx)
    if (marked !== messages[systemIdx]) {
      next = next.slice()
      next[systemIdx] = marked
      breakpointBudget.remaining -= 1
    }
  }

  const userIdx = lastIndexOfRole(next, 'user')
  if (userIdx >= 0 && breakpointBudget.remaining > 0) {
    const marked = markMessageWithCache(next[userIdx]!, ctx)
    if (marked !== next[userIdx]) {
      if (next === messages) next = next.slice()
      next[userIdx] = marked
      breakpointBudget.remaining -= 1
    }
  }

  return next
}

export function applyInlineCacheMarkersToSystem(
  system: unknown,
  _ctx: PromptCachingContext
): unknown {
  if (system == null) return system

  if (typeof system === 'string') {
    return {
      role: 'system',
      content: system,
      providerOptions: { ...INLINE_CACHE_PROVIDER_OPTIONS }
    }
  }

  if (typeof system === 'object' && system !== null) {
    const sys = system as { providerOptions?: Record<string, unknown>; content?: unknown }
    if (hasInlineCacheMarker(sys.providerOptions)) return system
    return {
      ...sys,
      providerOptions: mergeProviderOptions(sys.providerOptions, INLINE_CACHE_PROVIDER_OPTIONS)
    }
  }

  if (Array.isArray(system)) {
    if (system.length === 0) return system
    const last = system.length - 1
    return system.map((part, i) => {
      if (i !== last) return part
      if (typeof part === 'string') {
        return { type: 'text', text: part, providerOptions: { ...INLINE_CACHE_PROVIDER_OPTIONS } }
      }
      const p = part as { providerOptions?: Record<string, unknown> }
      return {
        ...part,
        providerOptions: mergeProviderOptions(p.providerOptions, INLINE_CACHE_PROVIDER_OPTIONS)
      }
    })
  }

  return system
}

export function applyInlineCacheMarkersToTools(
  tools: unknown,
  _ctx: PromptCachingContext,
  breakpointBudget: { remaining: number }
): unknown {
  if (!tools || breakpointBudget.remaining <= 0) return tools

  if (Array.isArray(tools)) {
    if (tools.length === 0) return tools
    const last = tools.length - 1
    return tools.map((tool, i) => {
      if (i !== last) return tool
      const t = tool as { providerOptions?: Record<string, unknown> }
      if (hasInlineCacheMarker(t.providerOptions)) return tool
      breakpointBudget.remaining -= 1
      return {
        ...tool,
        providerOptions: mergeProviderOptions(t.providerOptions, INLINE_CACHE_PROVIDER_OPTIONS)
      }
    })
  }

  if (typeof tools === 'object') {
    const entries = Object.entries(tools as Record<string, unknown>)
    if (entries.length === 0) return tools
    const lastKey = entries[entries.length - 1]![0]
    const lastTool = entries[entries.length - 1]![1] as { providerOptions?: Record<string, unknown> }
    if (hasInlineCacheMarker(lastTool?.providerOptions)) return tools
    breakpointBudget.remaining -= 1
    return {
      ...(tools as Record<string, unknown>),
      [lastKey]: {
        ...lastTool,
        providerOptions: mergeProviderOptions(lastTool?.providerOptions, INLINE_CACHE_PROVIDER_OPTIONS)
      }
    }
  }

  return tools
}

export function buildPromptCacheProviderOptions(
  ctx: PromptCachingContext,
  cacheKey: string
): Record<string, Record<string, unknown>> {
  const type = (ctx.providerType || '').toLowerCase()
  const options: Record<string, Record<string, unknown>> = {
    openai: {
      promptCacheKey: cacheKey,
      store: false
    }
  }

  if (type === 'openrouter') {
    options.openrouter = { prompt_cache_key: cacheKey }
  }

  return options
}

export function buildCachedSystemForStream(
  systemPrompt: string,
  ctx: PromptCachingContext
): string | SystemModelMessage {
  const strategy = resolveCachingStrategy(ctx)
  if (!strategy.inlineMarkers) return systemPrompt
  return applyInlineCacheMarkersToSystem(systemPrompt, ctx) as SystemModelMessage
}
