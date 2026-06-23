import {
  DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { createBaishouAgentGate, type IBaishouAgentGate } from './baishou-agent-gate.service'

export function cloneBaishouAgentGateConfig(
  source?: BaishouAgentGateConfig | null
): BaishouAgentGateConfig {
  const base = {
    ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
    exclusionList: [...DEFAULT_BAISHOU_AGENT_GATE_CONFIG.exclusionList],
    allowlist: []
  }
  if (!source) return base

  return {
    trustMode: source.trustMode ?? base.trustMode,
    exclusionList: [...(source.exclusionList ?? base.exclusionList)],
    allowlist: (source.allowlist ?? []).map((entry) => ({ ...entry })),
    actionRules: source.actionRules ? { ...source.actionRules } : undefined
  }
}

export interface ResolveSessionAgentGateOptions {
  agentGate?: IBaishouAgentGate
  userConfig?: Record<string, unknown>
  persistBaishouAgentGateConfig?: (config: BaishouAgentGateConfig) => Promise<void>
}

export function resolveSessionAgentGate(
  options: ResolveSessionAgentGateOptions
): { gate?: IBaishouAgentGate; mutableConfig?: BaishouAgentGateConfig } {
  if (options.agentGate) {
    return { gate: options.agentGate }
  }

  const raw = options.userConfig?.['baishou_agent_gate_config']
  const config = cloneBaishouAgentGateConfig(
    raw && typeof raw === 'object' ? (raw as BaishouAgentGateConfig) : null
  )

  const persist = options.persistBaishouAgentGateConfig
  const { gate } = createBaishouAgentGate({
    config,
    persistConfig: persist ? () => persist(config) : undefined
  })

  return { gate, mutableConfig: config }
}
