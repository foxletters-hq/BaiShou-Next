import { describe, expect, it } from 'vitest'
import { AgentGateKind, AgentGateRequestStatus, type AgentGateRequest } from '@baishou/shared'
import {
  canAlwaysAllowForRequest,
  resolveAlwaysAllowPrefixHint,
  resolveRequestGateResources,
  shouldShowAlwaysAllow
} from '../agent-gate.utils'

function toolRequest(
  patch: Partial<AgentGateRequest> & Pick<AgentGateRequest, 'action' | 'metadata'>
): AgentGateRequest {
  return {
    id: 'bag_test',
    sessionId: 's1',
    vaultName: 'Personal',
    status: AgentGateRequestStatus.Pending,
    kind: AgentGateKind.Tool,
    title: 'test',
    options: [],
    allowCustomInput: true,
    createdAt: Date.now(),
    ...patch
  }
}

describe('agent-gate.utils', () => {
  it('resolves shell resources from shellCommand field', () => {
    const request = toolRequest({
      action: 'workspace_run',
      metadata: { shellCommand: 'git status -sb' }
    })
    expect(resolveRequestGateResources(request)).toEqual([
      { kind: 'shell_command', value: 'git status -sb' }
    ])
  })

  it('resolves shell resources from nested metadata.resources only', () => {
    const request = toolRequest({
      action: 'workspace_run',
      metadata: {
        resources: [{ kind: 'shell_command', value: 'npm run build' }]
      }
    })
    expect(resolveRequestGateResources(request)).toEqual([
      { kind: 'shell_command', value: 'npm run build' }
    ])
    expect(canAlwaysAllowForRequest(request)).toBe(true)
    expect(shouldShowAlwaysAllow(request)).toBe(true)
    expect(resolveAlwaysAllowPrefixHint(request)).toBe('npm run *')
  })

  it('deduplicates shellCommand and nested resources', () => {
    const request = toolRequest({
      action: 'workspace_run',
      metadata: {
        shellCommand: 'git status',
        resources: [{ kind: 'shell_command', value: 'git status' }]
      }
    })
    expect(resolveRequestGateResources(request)).toEqual([
      { kind: 'shell_command', value: 'git status' }
    ])
  })

  it('shows always prefix hint for prefixable workspace_run', () => {
    const request = toolRequest({
      action: 'workspace_run',
      metadata: { shellCommand: 'git status -sb' }
    })
    expect(resolveAlwaysAllowPrefixHint(request)).toBe('git status *')
    expect(shouldShowAlwaysAllow(request)).toBe(true)
  })

  it('hides always for dangerous shell commands', () => {
    const request = toolRequest({
      action: 'workspace_run',
      metadata: { shellCommand: 'rm -rf dist' }
    })
    expect(canAlwaysAllowForRequest(request)).toBe(false)
    expect(shouldShowAlwaysAllow(request)).toBe(false)
    expect(resolveAlwaysAllowPrefixHint(request)).toBeNull()
  })

  it('allows always for normal mutating tools without shell', () => {
    const request = toolRequest({
      action: 'diary_edit',
      metadata: {}
    })
    expect(canAlwaysAllowForRequest(request)).toBe(true)
    expect(resolveAlwaysAllowPrefixHint(request)).toBeNull()
  })

  it('does not show always for non-tool requests', () => {
    const request = toolRequest({
      action: 'workspace_run',
      kind: AgentGateKind.Proactive,
      metadata: { shellCommand: 'git status' }
    })
    expect(canAlwaysAllowForRequest(request)).toBe(false)
    expect(shouldShowAlwaysAllow(request)).toBe(false)
  })
})
