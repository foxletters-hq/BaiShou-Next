import { AsyncLocalStorage } from 'node:async_hooks'

/** OpenAI 兼容请求体里注入的思考开关 / 预算 / 强度（fetch 拦截读取） */
export type OpenAiThinkingBodyInject = {
  enableThinking?: boolean
  budgetTokens?: number
  /**
   * 写入 chat/completions 的 reasoning_effort。
   * 用于 DeepSeek V4 的 max 等 @ai-sdk/openai 校验不放行的档位。
   */
  reasoningEffort?: string
  /**
   * OpenRouter 方言：body.reasoning = { effort }
   *（toggle / MiniMax 等仍可能 body 注入；effort 优先走 openaiCompatible providerOptions）
   */
  openRouterReasoning?: { effort: string }
  /** MiniMax-M3 openai-compat：body.thinking = { type } */
  thinkingType?: 'disabled' | 'adaptive' | 'enabled'
  /** 其它需原样合并进 chat/completions JSON 的字段 */
  extraBody?: Record<string, unknown>
}

const als = new AsyncLocalStorage<OpenAiThinkingBodyInject>()

function hasInjectPayload(inject: OpenAiThinkingBodyInject | undefined): boolean {
  if (!inject) return false
  return (
    inject.enableThinking != null ||
    inject.budgetTokens != null ||
    (typeof inject.reasoningEffort === 'string' && inject.reasoningEffort.length > 0) ||
    Boolean(inject.openRouterReasoning?.effort) ||
    Boolean(inject.thinkingType) ||
    Boolean(inject.extraBody && Object.keys(inject.extraBody).length > 0)
  )
}

export function runWithOpenAiThinkingInject<T>(
  inject: OpenAiThinkingBodyInject | undefined,
  fn: () => T
): T {
  if (!hasInjectPayload(inject)) {
    return fn()
  }
  return als.run(inject!, fn)
}

export async function runWithOpenAiThinkingInjectAsync<T>(
  inject: OpenAiThinkingBodyInject | undefined,
  fn: () => Promise<T>
): Promise<T> {
  if (!hasInjectPayload(inject)) {
    return fn()
  }
  return als.run(inject!, fn)
}

export function getOpenAiThinkingInject(): OpenAiThinkingBodyInject | undefined {
  return als.getStore()
}

/** 将 ALS 注入写入 chat/completions body */
export function applyOpenAiThinkingBodyInject(
  body: Record<string, unknown>,
  inject?: OpenAiThinkingBodyInject
): boolean {
  const src = inject ?? getOpenAiThinkingInject()
  if (!src) return false
  let mutated = false
  if (typeof src.enableThinking === 'boolean') {
    body.enable_thinking = src.enableThinking
    mutated = true
  }
  if (typeof src.budgetTokens === 'number' && src.budgetTokens > 0) {
    body.budget_tokens = src.budgetTokens
    // 部分网关 / 通义别名
    body.thinking_budget = src.budgetTokens
    mutated = true
  }
  if (typeof src.reasoningEffort === 'string' && src.reasoningEffort) {
    body.reasoning_effort = src.reasoningEffort
    mutated = true
  }
  if (src.openRouterReasoning?.effort) {
    body.reasoning = { effort: src.openRouterReasoning.effort }
    mutated = true
  }
  if (src.thinkingType) {
    body.thinking = { type: src.thinkingType }
    mutated = true
  }
  if (src.extraBody) {
    Object.assign(body, src.extraBody)
    mutated = true
  }
  return mutated
}
