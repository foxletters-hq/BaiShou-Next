import { AGENT_TOOL_UI_ONLY_IDS } from '../constants/agent-tools-ui.constants'
import { AgentGateEffect } from './agent-gate.enums'
import {
  COMPANION_GATE_CAPABILITIES,
  isCompanionGateCapabilityId,
  type AgentGateCapabilityState
} from './agent-gate-capability.util'

const UI_ONLY_TOOL_ID_SET = new Set<string>(AGENT_TOOL_UI_ONLY_IDS)

/** 拒绝写入 disabledToolIds；允许 / 询问则移出。 */
export function nextDisabledToolIdsForEffect(
  disabledToolIds: readonly string[] | undefined,
  toolId: string,
  effect: AgentGateEffect
): string[] {
  const next = new Set(disabledToolIds ?? [])
  if (effect === AgentGateEffect.Deny) next.add(toolId)
  else next.delete(toolId)
  return [...next]
}

/** 伙伴对话页：禁用列表优先，其次门禁能力矩阵，再回落到能力默认值。 */
export function resolveCompanionToolEffect(
  toolId: string,
  disabledToolIds: readonly string[] | undefined,
  capabilityState?: Pick<AgentGateCapabilityState, 'effects'> | null
): AgentGateEffect {
  if ((disabledToolIds ?? []).includes(toolId)) return AgentGateEffect.Deny
  if (isCompanionGateCapabilityId(toolId)) {
    const fromState = capabilityState?.effects[toolId]
    if (fromState) return fromState
    return (
      COMPANION_GATE_CAPABILITIES.find((cap) => cap.id === toolId)?.defaultEffect ??
      AgentGateEffect.Ask
    )
  }
  return AgentGateEffect.Allow
}

export function companionToolEffectOptions(toolId: string): AgentGateEffect[] {
  if (UI_ONLY_TOOL_ID_SET.has(toolId)) {
    return [AgentGateEffect.Allow, AgentGateEffect.Deny]
  }
  return [AgentGateEffect.Allow, AgentGateEffect.Ask, AgentGateEffect.Deny]
}
