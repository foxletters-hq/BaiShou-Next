import { AgentGateEffect, AgentGateProfileId, AgentGateTrustMode } from './agent-gate.enums'
import type { AgentGatePermissionRule } from './agent-gate.types'

export const DEFAULT_AGENT_GATE_EXCLUSION_LIST = [
  'diary_delete',
  'memory_delete',
  'workspace_delete'
] as const

export const AGENT_GATE_REQUEST_ID_PREFIX = 'bag_'
export const AGENT_GATE_ALLOWLIST_ENTRY_ID_PREFIX = 'bagal_'
export const BAISHOU_AGENT_GATE_CONFIG_KEY = 'baishou_agent_gate_config'

export const AGENT_GATE_LIFECYCLE_COMPRESSION_SAVE_DIARY = 'lifecycle_compression_save_diary'

/** Default consecutive same-fingerprint asserts before forcing Ask */
export const DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD = 3

/** Prefix for reject-with-feedback messages returned to the model */
export const AGENT_GATE_CORRECTED_FEEDBACK_PREFIX = '[用户纠正]'

/**
 * Scene default rules (stacked under user permissionRules).
 * Strongest matching effect wins (Deny > Ask > Allow).
 */
export const AGENT_GATE_PROFILE_DEFAULT_RULES: Record<
  AgentGateProfileId,
  readonly AgentGatePermissionRule[]
> = {
  [AgentGateProfileId.Companion]: [{ action: 'workspace_*', effect: AgentGateEffect.Deny }],
  [AgentGateProfileId.Workspace]: [
    { action: 'diary_*', effect: AgentGateEffect.Deny },
    { action: 'memory_*', effect: AgentGateEffect.Deny },
    { action: 'graph_upsert', effect: AgentGateEffect.Deny },
    // G3.2: in-workspace read-only tools default Allow (external_path still Ask later)
    { action: 'workspace_list', effect: AgentGateEffect.Allow },
    { action: 'workspace_read', effect: AgentGateEffect.Allow }
  ]
}

export const DEFAULT_BAISHOU_AGENT_GATE_CONFIG = {
  trustMode: AgentGateTrustMode.Manual,
  exclusionList: [...DEFAULT_AGENT_GATE_EXCLUSION_LIST],
  allowlist: [],
  forceAskExternalPath: true,
  repeatAssertAskThreshold: DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD,
  hideDeniedTools: true
} as const
