import { AgentGateEffect, AgentGateRiskLevel } from './agent-gate.enums'
import { shouldDisableAlwaysForPreview, type AgentGatePreview } from './agent-gate-preview.types'
import { isAgentGateActionForceExcluded } from './agent-gate-policy.util'
import type { AgentGateResourceRef } from './agent-gate.types'

export interface ClampAgentGateEffectInput {
  action: string
  resources?: readonly AgentGateResourceRef[]
  exclusionList?: readonly string[]
  /** 已由调用方算出的 forceExclusion；缺省时按 exclusion 默认表与 metadata 推断 */
  forceExcluded?: boolean
  metadata?: Record<string, unknown>
  riskLevel?: AgentGateRiskLevel
  preview?: AgentGatePreview
}

/**
 * 红线钳制：求值结果为 Allow 时，命中排除 / 破坏性 / 截断预览则压回 Ask。
 * Deny 与 Ask 原样返回（允许 exclusion 上的显式 Deny 生效）。
 */
export function clampAgentGateEffect(
  effect: AgentGateEffect,
  input: ClampAgentGateEffectInput
): AgentGateEffect {
  if (effect !== AgentGateEffect.Allow) return effect

  const forceExcluded =
    input.forceExcluded ?? isAgentGateActionForceExcluded(input.action, input.metadata)
  if (forceExcluded) return AgentGateEffect.Ask

  if (input.exclusionList?.includes(input.action)) {
    return AgentGateEffect.Ask
  }

  if (input.riskLevel === AgentGateRiskLevel.Destructive) {
    return AgentGateEffect.Ask
  }

  if (shouldDisableAlwaysForPreview(input.preview)) {
    return AgentGateEffect.Ask
  }

  return AgentGateEffect.Allow
}
