import { describe, expect, it } from 'vitest'
import {
  AgentGateKind,
  AgentGateRequestStatus,
  type AgentGateRequest
} from '@baishou/shared'
import { resolveAlwaysDisabledReason, shouldShowAlwaysAllow } from '../agent-gate.utils'

function baseRequest(partial: Partial<AgentGateRequest> = {}): AgentGateRequest {
  return {
    id: 'r1',
    sessionId: 's1',
    vaultName: 'Personal',
    status: AgentGateRequestStatus.Pending,
    kind: AgentGateKind.Tool,
    action: 'workspace_write',
    title: '写入',
    options: [],
    allowCustomInput: true,
    metadata: {},
    createdAt: 1,
    ...partial
  }
}

describe('agent-gate.utils always disable', () => {
  it('hides Always when file preview is truncated', () => {
    const request = baseRequest({
      preview: {
        type: 'file_change',
        path: 'a.ts',
        kind: 'modify',
        additions: 1,
        deletions: 1,
        truncated: true
      }
    })
    expect(shouldShowAlwaysAllow(request)).toBe(false)
    expect(resolveAlwaysDisabledReason(request)).toContain('截断')
  })
})
