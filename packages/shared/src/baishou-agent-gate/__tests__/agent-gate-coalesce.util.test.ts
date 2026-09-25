import { describe, expect, it } from 'vitest'
import { AgentGateKind, AgentGateRequestStatus } from '../agent-gate.enums'
import type { AgentGateRequest } from '../agent-gate.types'
import {
  collapseAgentGatePendingRequests,
  resolveAgentGateToolCoalesceKey,
  resolveAgentGateVisibleGroupKey
} from '../agent-gate-coalesce.util'

function req(
  partial: Partial<AgentGateRequest> & Pick<AgentGateRequest, 'id' | 'action'>
): AgentGateRequest {
  return {
    sessionId: 'sess_1',
    vaultName: 'Personal',
    status: AgentGateRequestStatus.Pending,
    kind: AgentGateKind.Tool,
    title: partial.action,
    options: [],
    allowCustomInput: false,
    metadata: {},
    createdAt: 1,
    ...partial
  }
}

describe('resolveAgentGateToolCoalesceKey', () => {
  it('merges ordinary tool actions', () => {
    expect(
      resolveAgentGateToolCoalesceKey({
        kind: AgentGateKind.Tool,
        action: 'recall_relations'
      })
    ).toBe('recall_relations')
  })

  it('does not merge companion questions', () => {
    expect(
      resolveAgentGateToolCoalesceKey({
        kind: AgentGateKind.Proactive,
        action: 'companion_ask'
      })
    ).toBeNull()
  })

  it('keeps internal and external writes in different groups', () => {
    expect(
      resolveAgentGateToolCoalesceKey({
        kind: AgentGateKind.Tool,
        action: 'workspace_write',
        resources: [{ kind: 'workspace_path', value: 'src/a.ts' }]
      })
    ).toBe('workspace_edit')
    expect(
      resolveAgentGateToolCoalesceKey({
        kind: AgentGateKind.Tool,
        action: 'workspace_write',
        resources: [{ kind: 'external_path', value: 'C:/Outside/x.txt' }]
      })
    ).toBe('workspace_write::external::C:/Outside/x.txt')
  })

  it('should merge write patch and rename into one edit group', () => {
    expect(
      resolveAgentGateToolCoalesceKey({
        kind: AgentGateKind.Tool,
        action: 'workspace_patch',
        resources: [{ kind: 'workspace_path', value: 'src/a.ts' }]
      })
    ).toBe('workspace_edit')
    expect(
      resolveAgentGateToolCoalesceKey({
        kind: AgentGateKind.Tool,
        action: 'workspace_rename',
        resources: [{ kind: 'workspace_path', value: 'src/a.ts' }]
      })
    ).toBe('workspace_edit')
  })

  it('should still merge a truncated file-change into the edit group', () => {
    expect(
      resolveAgentGateToolCoalesceKey({
        kind: AgentGateKind.Tool,
        action: 'workspace_write',
        preview: {
          type: 'file_change',
          path: 'src/big.ts',
          kind: 'modify',
          additions: 80,
          deletions: 12,
          truncated: true
        }
      })
    ).toBe('workspace_edit')
  })

  it('should keep a dangerous command on its own card', () => {
    expect(
      resolveAgentGateToolCoalesceKey({
        kind: AgentGateKind.Tool,
        action: 'workspace_run',
        preview: {
          type: 'command',
          command: 'rm -rf /',
          dangerous: true
        }
      })
    ).toBeNull()
  })
})

describe('collapseAgentGatePendingRequests', () => {
  it('keeps one card for the same tool in a session', () => {
    const collapsed = collapseAgentGatePendingRequests([
      req({ id: 'a', action: 'recall_relations', createdAt: 10 }),
      req({ id: 'b', action: 'recall_relations', createdAt: 20, title: '回忆关系图谱 2' })
    ])
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.id).toBe('a')
    expect(collapsed[0]?.coalescedCount).toBe(2)
  })

  it('keeps companion questions separate', () => {
    const collapsed = collapseAgentGatePendingRequests([
      req({
        id: 'q1',
        action: 'companion_ask',
        kind: AgentGateKind.Proactive,
        createdAt: 1
      }),
      req({
        id: 'q2',
        action: 'companion_ask',
        kind: AgentGateKind.Proactive,
        createdAt: 2
      })
    ])
    expect(collapsed.map((item) => item.id)).toEqual(['q1', 'q2'])
  })

  it('does not merge different tools', () => {
    const collapsed = collapseAgentGatePendingRequests([
      req({ id: 'a', action: 'recall_relations', createdAt: 1 }),
      req({ id: 'b', action: 'diary_edit', createdAt: 2 })
    ])
    expect(collapsed.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('should keep write and patch previews on one card', () => {
    const collapsed = collapseAgentGatePendingRequests([
      req({
        id: 'a',
        action: 'workspace_write',
        createdAt: 1,
        preview: {
          type: 'file_change',
          path: 'a.md',
          kind: 'create',
          additions: 1,
          deletions: 0,
          diff: '+a'
        }
      }),
      req({
        id: 'b',
        action: 'workspace_patch',
        createdAt: 2,
        preview: {
          type: 'file_change',
          path: 'b.md',
          kind: 'modify',
          additions: 2,
          deletions: 1,
          diff: '+b'
        }
      })
    ])
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.previews?.map((item) => (item.type === 'file_change' ? item.path : ''))).toEqual(
      ['a.md', 'b.md']
    )
  })

  it('should keep every file preview when collapsing write cards', () => {
    const collapsed = collapseAgentGatePendingRequests([
      req({
        id: 'a',
        action: 'workspace_write',
        createdAt: 1,
        preview: {
          type: 'file_change',
          path: 'a.md',
          kind: 'create',
          additions: 1,
          deletions: 0,
          diff: '+a'
        }
      }),
      req({
        id: 'b',
        action: 'workspace_write',
        createdAt: 2,
        preview: {
          type: 'file_change',
          path: 'b.md',
          kind: 'create',
          additions: 2,
          deletions: 0,
          diff: '+b'
        }
      })
    ])
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.previews?.map((item) => (item.type === 'file_change' ? item.path : ''))).toEqual(
      ['a.md', 'b.md']
    )
  })

  it('groups by session', () => {
    expect(
      resolveAgentGateVisibleGroupKey(req({ id: 'a', action: 'recall_relations', sessionId: 's1' }))
    ).not.toBe(
      resolveAgentGateVisibleGroupKey(req({ id: 'b', action: 'recall_relations', sessionId: 's2' }))
    )
  })
})
