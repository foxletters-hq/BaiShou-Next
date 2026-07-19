import { DEFAULT_AGENT_GATE_EXCLUSION_LIST } from './agent-gate.defaults'
import { canPermanentlyAllowShellCommand } from './agent-gate-shell-match.util'
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
    resources?: readonly AgentGateResourceRef[]
  }
): boolean {
  const exclusionList = options?.exclusionList ?? DEFAULT_AGENT_GATE_EXCLUSION_LIST
  if (isAgentGateActionInExclusionList(action, exclusionList)) return false
  if (isAgentGateActionForceExcluded(action, options?.metadata)) return false
  const shellCommands = (options?.resources ?? [])
    .filter((r) => r.kind === 'shell_command')
    .map((r) => r.value)
  if (action === 'workspace_run' || shellCommands.length > 0) {
    if (shellCommands.length === 0) return false
    return shellCommands.every((cmd) => canPermanentlyAllowShellCommand(cmd))
  }
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

const AGENT_GATE_RESOURCE_KINDS = new Set<AgentGateResourceKind>([
  'file_path',
  'workspace_path',
  'external_path',
  'shell_command'
])

function isAgentGateResourceRef(value: unknown): value is AgentGateResourceRef {
  if (!value || typeof value !== 'object') return false
  const kind = (value as { kind?: unknown }).kind
  const resourceValue = (value as { value?: unknown }).value
  return (
    typeof kind === 'string' &&
    AGENT_GATE_RESOURCE_KINDS.has(kind as AgentGateResourceKind) &&
    typeof resourceValue === 'string' &&
    resourceValue.trim().length > 0
  )
}

/** Derive structured resources from gate metadata for pattern evaluation / UI display */
export function extractAgentGateResourcesFromMetadata(
  metadata?: Record<string, unknown>
): AgentGateResourceRef[] {
  if (!metadata) return []

  const fromFields: AgentGateResourceRef[] = []
  for (const { field, kind } of METADATA_RESOURCE_FIELDS) {
    const value = metadata[field]
    if (typeof value !== 'string' || !value.trim()) continue
    fromFields.push({ kind, value })
  }

  const nested = Array.isArray(metadata.resources)
    ? metadata.resources.filter(isAgentGateResourceRef)
    : undefined

  return mergeAgentGateResources(fromFields, nested)
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
