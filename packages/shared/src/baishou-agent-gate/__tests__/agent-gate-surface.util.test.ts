import { describe, expect, it } from 'vitest'
import { AgentGateKind, AgentGateReply, AgentGateRequestStatus } from '../agent-gate.enums'
import type { AgentGatePartData, AgentGateRequest } from '../agent-gate.types'
import {
  collectAgentGatePartDataForSurface,
  collectUnresolvedAgentGateRequestsForSurface,
  isAgentGateScopeOnSurface,
  shouldRenderAgentGateHistoryCard
} from '../agent-gate-surface.util'

function request(scope?: AgentGateRequest['scope']): AgentGateRequest {
  return {
    id: 'g1',
    sessionId: 's1',
    vaultName: 'Personal',
    status: AgentGateRequestStatus.Pending,
    kind: AgentGateKind.Tool,
    action: 'workspace_write',
    title: '写入文件',
    options: [],
    allowCustomInput: true,
    metadata: {},
    createdAt: 1,
    scope
  }
}

function part(scope?: AgentGateRequest['scope']): { type: string; data: AgentGatePartData } {
  return {
    type: 'agent_gate',
    data: {
      request: request(scope),
      resolution: { requestId: 'g1', reply: AgentGateReply.Once, resolvedAt: 2 }
    }
  }
}

describe('isAgentGateScopeOnSurface', () => {
  it('should hide workspace-scoped gates on the companion surface', () => {
    expect(
      isAgentGateScopeOnSurface('companion', { kind: 'workspace', workspaceId: 'ws-1' })
    ).toBe(false)
  })

  it('should show workspace-scoped gates on the workspace surface', () => {
    expect(
      isAgentGateScopeOnSurface('workspace', { kind: 'workspace', workspaceId: 'ws-1' })
    ).toBe(true)
  })

  it('should hide companion-scoped gates on the workspace surface', () => {
    expect(isAgentGateScopeOnSurface('workspace', { kind: 'companion' })).toBe(false)
  })

  it('should keep a missing scope visible on the current surface', () => {
    expect(isAgentGateScopeOnSurface('companion', undefined)).toBe(true)
    expect(isAgentGateScopeOnSurface('workspace', undefined)).toBe(true)
  })
})

describe('collectAgentGatePartDataForSurface', () => {
  it('should collect only companion-scoped gate parts on the companion surface', () => {
    const parts = [
      part({ kind: 'companion' }),
      part({ kind: 'workspace', workspaceId: 'ws-1' }),
      { type: 'text', data: { text: 'hi' } }
    ]
    const collected = collectAgentGatePartDataForSurface(parts, 'companion')
    expect(collected).toHaveLength(1)
    expect(collected[0]?.request.scope).toEqual({ kind: 'companion' })
  })

  it('should collect only workspace-scoped gate parts on the workspace surface', () => {
    const parts = [part({ kind: 'companion' }), part({ kind: 'workspace', workspaceId: 'ws-1' })]
    const collected = collectAgentGatePartDataForSurface(parts, 'workspace')
    expect(collected).toHaveLength(1)
    expect(collected[0]?.request.scope).toEqual({ kind: 'workspace', workspaceId: 'ws-1' })
  })
})

describe('collectUnresolvedAgentGateRequestsForSurface', () => {
  it('should keep a pending companion_ask so the dock can recover after persist', () => {
    const parts = [
      {
        type: 'agent_gate',
        data: {
          request: {
            ...request({ kind: 'companion' }),
            action: 'companion_ask',
            title: '你在哪座城市？'
          }
        }
      },
      part({ kind: 'companion' })
    ]
    const pending = collectUnresolvedAgentGateRequestsForSurface(parts, 'companion')
    expect(pending).toHaveLength(1)
    expect(pending[0]?.action).toBe('companion_ask')
  })
})

describe('shouldRenderAgentGateHistoryCard', () => {
  it('should hide companion_ask history cards because the tool row already keeps the answer', () => {
    expect(
      shouldRenderAgentGateHistoryCard({
        request: { ...request({ kind: 'companion' }), action: 'companion_ask' },
        resolution: { requestId: 'g1', reply: AgentGateReply.Once, resolvedAt: 2 }
      })
    ).toBe(false)
  })

  it('should keep tool-gate history cards for write and run confirmations', () => {
    expect(
      shouldRenderAgentGateHistoryCard({
        request: request({ kind: 'workspace', workspaceId: 'ws-1' }),
        resolution: { requestId: 'g1', reply: AgentGateReply.Once, resolvedAt: 2 }
      })
    ).toBe(true)
  })
})

