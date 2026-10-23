import {
  AGENT_GATE_ALLOWLIST_ENTRY_ID_PREFIX,
  AGENT_GATE_REQUEST_ID_PREFIX
} from './agent-gate.defaults'

function randomSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function createAgentGateRequestId(): string {
  return `${AGENT_GATE_REQUEST_ID_PREFIX}${randomSuffix()}`
}

export function createAgentGateAllowlistEntryId(): string {
  return `${AGENT_GATE_ALLOWLIST_ENTRY_ID_PREFIX}${randomSuffix()}`
}
