import type { ReasoningEffortSetting } from '@baishou/shared'
import {
  buildReasoningProviderOptions,
  buildReasoningProviderOptionsResult,
  type BuiltReasoningOptions
} from './reasoning-provider-options'
import type { ReasoningApiShapeContext } from './reasoning-api-shape'

/** 探活 / 标题 / 压缩等小任务：取最弱可用档（含 body inject） */
export function buildSmallTaskReasoningOptions(
  ctx: ReasoningApiShapeContext
): BuiltReasoningOptions {
  return buildReasoningProviderOptionsResult({ ...ctx, small: true })
}

/** @deprecated 仅返回 providerOptions；依赖 inject 的供应商请用 buildSmallTaskReasoningOptions */
export function buildSmallTaskReasoningProviderOptions(
  ctx: ReasoningApiShapeContext
): Record<string, Record<string, unknown>> | undefined {
  return buildSmallTaskReasoningOptions(ctx).providerOptions
}

export function buildDefaultReasoningProviderOptions(
  ctx: ReasoningApiShapeContext & {
    effort?: ReasoningEffortSetting
    budgetTokens?: number | null
    hasTools?: boolean
  }
): Record<string, Record<string, unknown>> | undefined {
  return buildReasoningProviderOptions(ctx)
}

export function buildDefaultReasoningOptions(
  ctx: ReasoningApiShapeContext & {
    effort?: ReasoningEffortSetting
    budgetTokens?: number | null
    hasTools?: boolean
  }
): BuiltReasoningOptions {
  return buildReasoningProviderOptionsResult(ctx)
}
