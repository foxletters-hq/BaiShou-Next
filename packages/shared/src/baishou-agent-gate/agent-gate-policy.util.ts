import { DEFAULT_AGENT_GATE_EXCLUSION_LIST } from './agent-gate.defaults'
import type { AgentGateResourceKind, AgentGateResourceRef } from './agent-gate.types'

/** Actions that must never be permanently allowlisted, even via custom IPC/UI. */
export const FORCE_EXCLUDED_AGENT_GATE_ACTIONS = DEFAULT_AGENT_GATE_EXCLUSION_LIST

export function isAgentGateActionForceExcluded(
  action: string,
  metadata?: Record<string, unknown>
): boolean {
  if (metadata?.forceExclusion === true) return true
  return (FORCE_EXCLUDED_AGENT_GATE_ACTIONS as readonly string[]).includes(action)
}

export function isAgentGateActionInExclusionList(
  action: string,
  exclusionList: readonly string[]
): boolean {
  return exclusionList.includes(action)
}

export function canPermanentlyAllowAgentGateAction(
  action: string,
  options?: {
    exclusionList?: readonly string[]
    metadata?: Record<string, unknown>
  }
): boolean {
  const exclusionList = options?.exclusionList ?? DEFAULT_AGENT_GATE_EXCLUSION_LIST
  if (isAgentGateActionInExclusionList(action, exclusionList)) return false
  if (isAgentGateActionForceExcluded(action, options?.metadata)) return false
  return true
}

const METADATA_RESOURCE_FIELDS: ReadonlyArray<{
  field: string
  kind: AgentGateResourceKind
}> = [
  { field: 'workspacePath', kind: 'workspace_path' },
  { field: 'workspace_path', kind: 'workspace_path' },
  { field: 'path', kind: 'workspace_path' },
  { field: 'new_path', kind: 'workspace_path' },
  { field: 'filePath', kind: 'file_path' },
  { field: 'file_path', kind: 'file_path' },
  { field: 'externalPath', kind: 'external_path' },
  { field: 'external_path', kind: 'external_path' },
  { field: 'shellCommand', kind: 'shell_command' },
  { field: 'shell_command', kind: 'shell_command' }
]

/** Derive structured resources from gate metadata for pattern evaluation / UI display */
export function extractAgentGateResourcesFromMetadata(
  metadata?: Record<string, unknown>
): AgentGateResourceRef[] {
  if (!metadata) return []

  const resources: AgentGateResourceRef[] = []
  const seen = new Set<string>()

  for (const { field, kind } of METADATA_RESOURCE_FIELDS) {
    const value = metadata[field]
    if (typeof value !== 'string' || !value.trim()) continue
    const key = `${kind}:${value}`
    if (seen.has(key)) continue
    seen.add(key)
    resources.push({ kind, value })
  }

  return resources
}

export function mergeAgentGateResources(
  ...groups: Array<readonly AgentGateResourceRef[] | undefined>
): AgentGateResourceRef[] {
  const merged: AgentGateResourceRef[] = []
  const seen = new Set<string>()

  for (const group of groups) {
    if (!group) continue
    for (const resource of group) {
      const key = `${resource.kind}:${resource.value}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(resource)
    }
  }

  return merged
}
