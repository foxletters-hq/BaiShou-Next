import { AgentGateProfileId } from './agent-gate.enums'
import { AGENT_GATE_PROFILE_DEFAULT_RULES } from './agent-gate.defaults'
import type { AgentGatePermissionRule } from './agent-gate.types'

export function resolveAgentGateProfileId(
  value: unknown,
  fallback: AgentGateProfileId = AgentGateProfileId.Companion
): AgentGateProfileId {
  if (value === AgentGateProfileId.Workspace || value === 'workspace') {
    return AgentGateProfileId.Workspace
  }
  if (value === AgentGateProfileId.Companion || value === 'companion') {
    return AgentGateProfileId.Companion
  }
  return fallback
}

/** Profile defaults for the given scene (immutable copy). */
export function getAgentGateProfileRules(
  profileId: AgentGateProfileId = AgentGateProfileId.Companion
): AgentGatePermissionRule[] {
  return AGENT_GATE_PROFILE_DEFAULT_RULES[profileId].map((rule) => ({ ...rule }))
}
