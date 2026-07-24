import { cloneBaishouAgentGateConfig, type BaishouAgentGateConfig } from '@baishou/shared'
import { createBaishouAgentGate, type IBaishouAgentGate } from './baishou-agent-gate.service'

export { cloneBaishouAgentGateConfig }

export interface ResolveSessionAgentGateOptions {
  agentGate?: IBaishouAgentGate
  userConfig?: Record<string, unknown>
  persistBaishouAgentGateConfig?: (config: BaishouAgentGateConfig) => Promise<void>
}

export function resolveSessionAgentGate(options: ResolveSessionAgentGateOptions): {
  gate?: IBaishouAgentGate
  mutableConfig?: BaishouAgentGateConfig
} {
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
