import type { AgentGateAssertInput, AgentGateResourceRef } from './agent-gate.types'

/** Lightweight non-crypto hash for fingerprint payloads */
export function agentGateSimpleHash(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function resourcesKey(resources: readonly AgentGateResourceRef[] | undefined): string {
  if (!resources || resources.length === 0) return ''
  return [...resources]
    .map((resource) => `${resource.kind}:${resource.value}`)
    .sort()
    .join('|')
}

/**
 * Build a stable fingerprint for repeat-assert detection within one session.
 * Same action + equivalent key args → same fingerprint.
 */
export function buildAgentGateAssertFingerprint(
  input: Pick<AgentGateAssertInput, 'action' | 'metadata' | 'resources'>
): string {
  const metadata = input.metadata ?? {}
  const action = input.action
  const parts: string[] = [action]

  if (action === 'memory_store') {
    const content = asString(metadata.preview) ?? asString(metadata.content) ?? ''
    parts.push(agentGateSimpleHash(content.trim().slice(0, 256)))
  } else if (action.startsWith('diary_')) {
    parts.push(asString(metadata.date) ?? '')
    parts.push(asString(metadata.mode) ?? '')
  } else if (action.startsWith('workspace_')) {
    parts.push(resourcesKey(input.resources))
    parts.push(asString(metadata.path) ?? asString(metadata.workspacePath) ?? '')
    parts.push(asString(metadata.new_path) ?? '')
  } else if (action === 'graph_upsert') {
    const summary =
      asString(metadata.preview) ??
      asString(metadata.summary) ??
      JSON.stringify(metadata.entities ?? metadata.edges ?? '')
    parts.push(agentGateSimpleHash(summary))
  } else {
    parts.push(resourcesKey(input.resources))
    const titleHint = asString(metadata.preview) ?? asString(metadata.path) ?? ''
    if (titleHint) parts.push(agentGateSimpleHash(titleHint.slice(0, 256)))
  }

  return parts.join('::')
}
