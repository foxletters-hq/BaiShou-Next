import { AGENT_TOOL_UI_ONLY_IDS } from '../constants/agent-tools-ui.constants'
import { AgentGateEffect } from './agent-gate.enums'
import {
  applyCapabilityToConfig,
  COMPANION_GATE_CAPABILITIES,
  isCompanionGateCapabilityId,
  type AgentGateCapabilityId,
  type AgentGateCapabilityState
} from './agent-gate-capability.util'
import type { BaishouAgentGateConfig } from './agent-gate.types'

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

/** 从伙伴配置里去掉指定动作的始终允许条目，避免记忆层盖过能力矩阵。 */
export function stripCompanionAllowlistActions(
  config: BaishouAgentGateConfig,
  actions: readonly string[]
): BaishouAgentGateConfig {
  const drop = new Set(actions)
  return {
    ...config,
    allowlist: config.allowlist.filter((entry) => !drop.has(entry.action))
  }
}

/**
 * 把伙伴工具的整项始终允许条目折进能力矩阵的「允许」，并移出名单。
 * 非伙伴动作（例如工作区命令前缀）保留在名单里。
 */
export function foldCompanionAllowlistIntoCapabilities(
  config: BaishouAgentGateConfig
): BaishouAgentGateConfig {
  const companionActions = [
    ...new Set(
      config.allowlist
        .map((entry) => entry.action)
        .filter((action): action is AgentGateCapabilityId => isCompanionGateCapabilityId(action))
    )
  ]
  if (companionActions.length === 0) return config

  let next = config
  for (const action of companionActions) {
    next = applyCapabilityToConfig(next, 'companion', {
      capabilityId: action,
      effect: AgentGateEffect.Allow
    })
  }
  return stripCompanionAllowlistActions(next, companionActions)
}

/** 聊天里对伙伴工具点「始终允许」：写成能力允许，而不是名单条目。 */
export function applyCompanionAlwaysAllow(
  config: BaishouAgentGateConfig,
  action: string
): BaishouAgentGateConfig | null {
  if (!isCompanionGateCapabilityId(action)) return null
  return stripCompanionAllowlistActions(
    applyCapabilityToConfig(config, 'companion', {
      capabilityId: action,
      effect: AgentGateEffect.Allow
    }),
    [action]
  )
}
