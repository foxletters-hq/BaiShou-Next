import { AgentGateEffect, AgentGateRiskLevel } from './agent-gate.enums'
import { shouldDisableAlwaysForPreview, type AgentGatePreview } from './agent-gate-preview.types'
import { isAgentGateActionForceExcluded } from './agent-gate-policy.util'
import type { AgentGateResourceRef } from './agent-gate.types'
import { matchesCommandBlacklist } from './agent-gate-preset.util'

export interface ClampAgentGateEffectInput {
  action: string
  resources?: readonly AgentGateResourceRef[]
  exclusionList?: readonly string[]
  /** 命令黑名单（子串/通配）；与内置危险命令检测叠加 */
  commandBlacklist?: readonly string[]
  /** 已由调用方算出的 forceExclusion；缺省时按 exclusion 默认表与 metadata 推断 */
  forceExcluded?: boolean
  metadata?: Record<string, unknown>
  riskLevel?: AgentGateRiskLevel
  preview?: AgentGatePreview
  /**
   * 来自用户显式规则 / 始终允许 / 会话自动接受的 Allow。
   * 破坏性操作仅在此为 true 时放行，避免 `*: allow` 垫底误放行删除。
   */
  explicitAllow?: boolean
}

/**
 * 红线钳制：求值结果为 Allow 时，命中排除 / 破坏性 / 截断预览 / 命令黑名单则压回 Ask。
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

  const isDestructive =
    input.riskLevel === AgentGateRiskLevel.Destructive || input.action === 'workspace_delete'
  if (isDestructive && !input.explicitAllow) {
    return AgentGateEffect.Ask
  }

  if (shouldDisableAlwaysForPreview(input.preview)) {
    return AgentGateEffect.Ask
  }

  if (input.action === 'workspace_run') {
    const commands =
      input.resources
        ?.filter((r) => r.kind === 'shell_command')
        .map((r) => r.value)
        .filter(Boolean) ?? []
    const previewCommand =
      input.preview && input.preview.type === 'command' ? input.preview.command : undefined
    const candidates = commands.length > 0 ? commands : previewCommand ? [previewCommand] : []
    if (candidates.some((cmd) => matchesCommandBlacklist(cmd, input.commandBlacklist))) {
      return AgentGateEffect.Ask
    }
  }

  return AgentGateEffect.Allow
}
