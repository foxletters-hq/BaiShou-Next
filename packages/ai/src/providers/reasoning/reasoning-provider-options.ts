import {
  type ReasoningEffort,
  type ReasoningEffortSetting,
  normalizeReasoningEffortSetting,
  resolveEffectiveReasoningEffort,
  isOpenAiStyleReasoningModel,
  normalizeModelBaseId,
  getReasoningControlForModel,
  normalizeReasoningBudgetTokens,
  isMiniMaxM3Model,
  isGlm52ReasoningModel,
  isKimiThinkingControlModel,
  REASONING_EFFORTS
} from '@baishou/shared'
import {
  resolveReasoningApiShape,
  type ReasoningApiShapeContext
} from './reasoning-api-shape'
import { listReasoningVariants } from './reasoning-variants'
import type { OpenAiThinkingBodyInject } from './openai-thinking-inject'

export type BuildReasoningProviderOptionsParams = ReasoningApiShapeContext & {
  /** 用户选择或全局默认；auto 时 OpenAI 系用 medium */
  effort?: ReasoningEffortSetting
  /** 思考预算（token）；auto/未设则不传 */
  budgetTokens?: number | null
  /** 小任务：强制最弱档 */
  small?: boolean
  /** 是否携带 function tools（Chat 路径下推理模型需降级 none） */
  hasTools?: boolean
}

export type BuiltReasoningOptions = {
  providerOptions?: Record<string, Record<string, unknown>>
  /** 供 OpenAI 兼容 fetch 注入 enable_thinking / budget_tokens / reasoning_effort 等 */
  openAiThinkingInject?: OpenAiThinkingBodyInject
}

/** 取最接近的可用档位（auto→medium 时 DeepSeek 等无 medium 不致落到最弱档） */
function clampEffortToVariants(
  effort: ReasoningEffort,
  variants: { id: ReasoningEffort }[]
): ReasoningEffort {
  if (variants.length === 0) return effort
  if (variants.some((v) => v.id === effort)) return effort
  const order = REASONING_EFFORTS as readonly ReasoningEffort[]
  const targetIdx = order.indexOf(effort)
  if (targetIdx < 0) return variants[0]!.id
  let best = variants[0]!.id
  let bestDist = Number.POSITIVE_INFINITY
  for (const v of variants) {
    const idx = order.indexOf(v.id)
    const dist = idx < 0 ? 999 : Math.abs(idx - targetIdx)
    if (dist < bestDist) {
      bestDist = dist
      best = v.id
    }
  }
  return best
}

function openAiResponsesOptions(effort: ReasoningEffort): Record<string, unknown> {
  return {
    openai: {
      reasoningEffort: effort,
      reasoningSummary: 'auto',
      include: ['reasoning.encrypted_content'],
      store: false
    }
  }
}

/** Claude ≥4.7：adaptive + display summarized；4.6：adaptive 无 display（对齐参考） */
function isAnthropicModernAdaptive(modelId: string): boolean {
  const id = normalizeModelBaseId(modelId)
  return /claude.*4[.-][7-9]|claude.*4[.-]\d{2}|opus-4[.-][7-9]|sonnet-4[.-][7-9]|sonnet-5|opus-5|claude.*sonnet-5|claude.*opus-5/.test(
    id
  )
}

function isAnthropic46Adaptive(modelId: string): boolean {
  const id = normalizeModelBaseId(modelId)
  return /claude.*4[.-]6|opus-4[.-]6|sonnet-4[.-]6/.test(id)
}

function anthropicOptions(
  modelId: string,
  effort: ReasoningEffort,
  budgetTokens?: number
): Record<string, unknown> {
  const id = normalizeModelBaseId(modelId)
  const isOpus45 = /opus-4[.-]5|claude.*opus.*4[.-]5/.test(id)
  const isMiniMax = id.includes('minimax') && id.includes('m3')
  const isKimi = isKimiThinkingControlModel(modelId) || /^(kimi|moonshot)/.test(id)

  if (isMiniMax) {
    return {
      anthropic: {
        thinking: { type: effort === 'none' ? 'disabled' : 'adaptive' }
      }
    }
  }

  // GLM-5.2 on anthropic transport：仅顶层 effort（参考）
  if (isGlm52ReasoningModel(modelId)) {
    return { anthropic: { effort } }
  }

  if (isKimi) {
    return {
      anthropic: {
        thinking: { type: 'adaptive', display: 'summarized' },
        effort
      }
    }
  }

  if (isAnthropicModernAdaptive(modelId)) {
    return {
      anthropic: {
        thinking: { type: 'adaptive', display: 'summarized' },
        effort
      }
    }
  }

  if (isAnthropic46Adaptive(modelId)) {
    return {
      anthropic: {
        thinking: { type: 'adaptive' },
        effort
      }
    }
  }

  if (isOpus45) {
    return {
      anthropic: {
        thinking: {
          type: 'enabled',
          budgetTokens: budgetTokens && budgetTokens > 0 ? budgetTokens : 16000
        },
        effort
      }
    }
  }

  const resolvedBudget =
    budgetTokens && budgetTokens > 0 ? budgetTokens : effort === 'max' ? 31999 : 16000
  return {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: resolvedBudget }
    }
  }
}

function geminiOptions(
  modelId: string,
  effort: ReasoningEffort,
  budgetTokens?: number
): Record<string, unknown> {
  const id = normalizeModelBaseId(modelId)
  if (id.includes('gemini-2.5')) {
    const maxBudget = id.includes('pro') ? 32768 : 24576
    const thinkingBudget =
      budgetTokens && budgetTokens > 0 ? budgetTokens : effort === 'max' ? maxBudget : 16000
    return {
      google: {
        thinkingConfig: { includeThoughts: true, thinkingBudget }
      }
    }
  }
  const thinkingLevel =
    effort === 'minimal'
      ? 'minimal'
      : effort === 'low'
        ? 'low'
        : effort === 'high' || effort === 'max' || effort === 'xhigh'
          ? 'high'
          : 'medium'
  return {
    google: {
      thinkingConfig: { includeThoughts: true, thinkingLevel }
    }
  }
}

/**
 * 生成 streamText / generateText 的 providerOptions，以及 OpenAI 兼容体注入。
 */
export function buildReasoningProviderOptionsResult(
  params: BuildReasoningProviderOptionsParams
): BuiltReasoningOptions {
  const control = getReasoningControlForModel(params.modelId, params.providerType)
  const variants = listReasoningVariants(params)
  const shape = resolveReasoningApiShape(params)
  const budget =
    (control.supportsBudget || control.mode === 'budget') && control.maxBudgetTokens
      ? control.maxBudgetTokens
      : normalizeReasoningBudgetTokens(params.budgetTokens, control.maxBudgetTokens)

  // toggle 模式：自动=默认开；产品无「关闭」档（历史 none 也当开）
  if (control.supportsToggle || control.mode === 'toggle') {
    if (params.small) {
      return {
        openAiThinkingInject: {
          enableThinking: false
        }
      }
    }
    return {
      openAiThinkingInject: {
        enableThinking: true,
        ...(budget ? { budgetTokens: budget } : {})
      }
    }
  }

  if (variants.length === 0 || shape === 'none') {
    return budget && (shape === 'anthropic' || shape === 'gemini')
      ? {
          providerOptions:
            shape === 'anthropic'
              ? (anthropicOptions(params.modelId, 'high', budget) as Record<
                  string,
                  Record<string, unknown>
                >)
              : (geminiOptions(params.modelId, 'high', budget) as Record<
                  string,
                  Record<string, unknown>
                >)
        }
      : {}
  }

  let effort: ReasoningEffort
  if (params.small) {
    effort = variants[0]!.id
  } else if (
    shouldForceChatCompletionsReasoningNone({
      modelId: params.modelId,
      hasTools: Boolean(params.hasTools),
      apiShape: shape
    })
  ) {
    effort = 'none'
  } else {
    const setting = normalizeReasoningEffortSetting(params.effort)
    const resolved =
      setting === 'auto' ? resolveEffectiveReasoningEffort('auto', 'medium')! : setting
    effort = clampEffortToVariants(resolved, variants)
  }

  let providerOptions: Record<string, Record<string, unknown>> | undefined
  let openAiThinkingInject: OpenAiThinkingBodyInject | undefined

  switch (shape) {
    case 'responses':
      providerOptions = openAiResponsesOptions(effort) as Record<string, Record<string, unknown>>
      break
    case 'chat':
      // MiniMax-M3 openai-compat：thinking.type（对齐参考）
      if (isMiniMaxM3Model(params.modelId)) {
        openAiThinkingInject = {
          thinkingType: effort === 'none' ? 'disabled' : 'adaptive'
        }
        break
      }
      // @ai-sdk/openai-compatible：reasoningEffort 为 string，可传 max
      providerOptions = {
        openaiCompatible: { reasoningEffort: effort }
      }
      break
    case 'anthropic':
      providerOptions = anthropicOptions(params.modelId, effort, budget) as Record<
        string,
        Record<string, unknown>
      >
      break
    case 'gemini':
      providerOptions = geminiOptions(params.modelId, effort, budget) as Record<
        string,
        Record<string, unknown>
      >
      break
    case 'openrouter':
      // openrouter 方言仍走 body 注入
      openAiThinkingInject = { openRouterReasoning: { effort } }
      break
    default:
      providerOptions = undefined
  }

  return { providerOptions, openAiThinkingInject }
}

/**
 * 兼容旧调用：只返回 providerOptions。
 */
export function buildReasoningProviderOptions(
  params: BuildReasoningProviderOptionsParams
): Record<string, Record<string, unknown>> | undefined {
  return buildReasoningProviderOptionsResult(params).providerOptions
}

/** Chat Completions + tools 降级：仅当仍走 chat 且为 OpenAI 推理模型时强制 none */
export function shouldForceChatCompletionsReasoningNone(params: {
  modelId: string
  hasTools: boolean
  apiShape: ReturnType<typeof resolveReasoningApiShape>
}): boolean {
  return (
    params.hasTools &&
    params.apiShape === 'chat' &&
    isOpenAiStyleReasoningModel(params.modelId)
  )
}
