import { AgentGateTrustMode } from './agent-gate.enums'

export const DEFAULT_AGENT_GATE_EXCLUSION_LIST = [
  'diary_delete',
  'memory_delete',
  'workspace_delete'
] as const

export const AGENT_GATE_REQUEST_ID_PREFIX = 'bag_'
export const AGENT_GATE_ALLOWLIST_ENTRY_ID_PREFIX = 'bagal_'
export const BAISHOU_AGENT_GATE_CONFIG_KEY = 'baishou_agent_gate_config'

export const AGENT_GATE_LIFECYCLE_COMPRESSION_SAVE_DIARY = 'lifecycle_compression_save_diary'

export const DEFAULT_BAISHOU_AGENT_GATE_CONFIG = {
  trustMode: AgentGateTrustMode.Manual,
  exclusionList: [...DEFAULT_AGENT_GATE_EXCLUSION_LIST],
  allowlist: []
} as const
