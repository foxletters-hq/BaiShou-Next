import { beforeEach, describe, expect, it } from 'vitest'
import type { AgentGateRequest } from '@baishou/shared'
import { AgentGateKind, AgentGateReply, AgentGateRequestStatus } from '@baishou/shared'
import {
  clearAgentGateInboxTombstonesForTests,
  selectActivePendingForSession,
  selectQueueNeighborId,
  selectQueuePosition,
  selectResolvedLiveForSession,
  selectSameActionCountInSession,
  useAgentGateInboxStore
} from '../agent-gate-inbox.store'

function req(
  partial: Partial<AgentGateRequest> & Pick<AgentGateRequest, 'id' | 'sessionId' | 'createdAt'>
): AgentGateRequest {
  return {
    vaultName: 'Personal',
    status: AgentGateRequestStatus.Pending,
    kind: AgentGateKind.Tool,
    action: 'workspace_write',
    title: 't',
    options: [],
    allowCustomInput: true,
    metadata: {},
    ...partial
  }
}

describe('agent-gate-inbox.store', () => {
  beforeEach(() => {
    useAgentGateInboxStore.getState().reset()
    clearAgentGateInboxTombstonesForTests()
  })

  it('keeps ask order by createdAt and dedupes by id', () => {
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'b', sessionId: 's1', createdAt: 20, action: 'diary_edit' }))
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'a', sessionId: 's1', createdAt: 10, action: 'workspace_write' }))
    useAgentGateInboxStore
      .getState()
      .upsertAsked(
        req({ id: 'b', sessionId: 's1', createdAt: 20, action: 'diary_edit', title: 'updated' })
      )
    const pending = useAgentGateInboxStore.getState().pending
    expect(pending.map((r) => r.id)).toEqual(['a', 'b'])
    expect(pending[1]?.title).toBe('updated')
  })

  it('removes replied precisely and advances active request', () => {
    useAgentGateInboxStore
      .getState()
      .hydrate([
        req({ id: 'a', sessionId: 's1', createdAt: 1, action: 'workspace_write' }),
        req({ id: 'b', sessionId: 's1', createdAt: 2, action: 'diary_edit' }),
        req({ id: 'c', sessionId: 's2', createdAt: 3, action: 'url_read' })
      ])
    expect(selectActivePendingForSession(useAgentGateInboxStore.getState(), 's1')?.id).toBe('a')
    useAgentGateInboxStore.getState().removeReplied('a')
    const next = useAgentGateInboxStore.getState()
    expect(selectActivePendingForSession(next, 's1')?.id).toBe('b')
    expect(selectQueuePosition(next, 's1', 'b')).toEqual({ index: 1, total: 1 })
    expect(next.pending.map((r) => r.id)).toEqual(['b', 'c'])
  })

  it('should drop cancelled requests without treating them as answered', () => {
    useAgentGateInboxStore.getState().hydrate([
      req({
        id: 'ask',
        sessionId: 's1',
        createdAt: 1,
        kind: AgentGateKind.Proactive,
        action: 'companion_ask'
      }),
      req({ id: 'keep', sessionId: 's1', createdAt: 2, action: 'workspace_write' })
    ])
    useAgentGateInboxStore.getState().removeCancelled(['ask'])
    const next = useAgentGateInboxStore.getState()
    expect(next.pending.map((item) => item.id)).toEqual(['keep'])
    expect(selectResolvedLiveForSession(next, 's1')).toEqual([])
  })

  it('hydrates authoritatively and prunes ghost pending', () => {
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'ghost', sessionId: 's1', createdAt: 1 }))
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'keep', sessionId: 's1', createdAt: 2 }))
    useAgentGateInboxStore.getState().hydrate([req({ id: 'keep', sessionId: 's1', createdAt: 2 })])
    expect(useAgentGateInboxStore.getState().pending.map((r) => r.id)).toEqual(['keep'])
  })

  it('keeps asks that arrived during fetch when snapshot is provided', () => {
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'old', sessionId: 's1', createdAt: 10, action: 'workspace_write' }))
    const snapshotIdsAtFetchStart = new Set(
      useAgentGateInboxStore.getState().pending.map((item) => item.id)
    )
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'live', sessionId: 's1', createdAt: 50, action: 'diary_edit' }))
    useAgentGateInboxStore
      .getState()
      .hydrate([req({ id: 'old', sessionId: 's1', createdAt: 10, action: 'workspace_write' })], {
        snapshotIdsAtFetchStart
      })
    expect(useAgentGateInboxStore.getState().pending.map((r) => r.id)).toEqual(['old', 'live'])
  })

  it('does not resurrect ids removed during fetch via stale listPending', () => {
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'a', sessionId: 's1', createdAt: 1, action: 'workspace_write' }))
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'b', sessionId: 's1', createdAt: 2, action: 'diary_edit' }))
    const snapshotIdsAtFetchStart = new Set(
      useAgentGateInboxStore.getState().pending.map((item) => item.id)
    )
    useAgentGateInboxStore.getState().removeReplied('a')
    useAgentGateInboxStore
      .getState()
      .hydrate(
        [
          req({ id: 'a', sessionId: 's1', createdAt: 1, action: 'workspace_write' }),
          req({ id: 'b', sessionId: 's1', createdAt: 2, action: 'diary_edit' })
        ],
        { snapshotIdsAtFetchStart }
      )
    expect(useAgentGateInboxStore.getState().pending.map((r) => r.id)).toEqual(['b'])
  })

  it('counts same-action pending in a session for cascade hints', () => {
    useAgentGateInboxStore
      .getState()
      .hydrate([
        req({ id: '1', sessionId: 's1', createdAt: 1, action: 'workspace_write' }),
        req({ id: '2', sessionId: 's1', createdAt: 2, action: 'workspace_write' }),
        req({ id: '3', sessionId: 's1', createdAt: 3, action: 'workspace_run' })
      ])
    expect(
      selectSameActionCountInSession(useAgentGateInboxStore.getState(), 's1', 'workspace_write')
    ).toBe(1)
    expect(
      selectSameActionCountInSession(useAgentGateInboxStore.getState(), 's1', 'workspace_run')
    ).toBe(1)
    expect(selectQueuePosition(useAgentGateInboxStore.getState(), 's1', '1')).toEqual({
      index: 1,
      total: 2
    })
  })

  it('collapses duplicate tool asks so the queue does not show a second card', () => {
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'a', sessionId: 's1', createdAt: 1, action: 'recall_relations' }))
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'b', sessionId: 's1', createdAt: 2, action: 'recall_relations' }))
    const state = useAgentGateInboxStore.getState()
    expect(state.pending).toHaveLength(1)
    expect(state.pending[0]?.id).toBe('a')
    expect(state.pending[0]?.coalescedCount).toBe(2)
    expect(selectQueuePosition(state, 's1', 'a')).toEqual({ index: 1, total: 1 })
    expect(selectActivePendingForSession(state, 's1')?.id).toBe('a')
  })

  it('archives a replied request so the chat can show the latest confirmation', () => {
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'a', sessionId: 's1', createdAt: 1, action: 'recall_relations' }))
    useAgentGateInboxStore.getState().removeReplied('a', {
      requestId: 'a',
      reply: AgentGateReply.Always,
      resolvedAt: 99
    })
    const state = useAgentGateInboxStore.getState()
    expect(state.pending).toHaveLength(0)
    const live = selectResolvedLiveForSession(state, 's1')
    expect(live).toHaveLength(1)
    expect(live[0]?.resolution?.reply).toBe(AgentGateReply.Always)
    expect(live[0]?.request.title).toBe('t')
    expect(selectResolvedLiveForSession(state, 's1')).toBe(live)
  })

  it('should return the previous and next pending ids for queue paging', () => {
    useAgentGateInboxStore.getState().hydrate([
      req({
        id: 'q1',
        sessionId: 's1',
        createdAt: 1,
        action: 'companion_ask',
        kind: AgentGateKind.Proactive
      }),
      req({
        id: 'q2',
        sessionId: 's1',
        createdAt: 2,
        action: 'companion_ask',
        kind: AgentGateKind.Proactive
      }),
      req({
        id: 'q3',
        sessionId: 's1',
        createdAt: 3,
        action: 'companion_ask',
        kind: AgentGateKind.Proactive
      })
    ])
    const state = useAgentGateInboxStore.getState()
    expect(selectQueueNeighborId(state, 's1', 'q2', -1)).toBe('q1')
    expect(selectQueueNeighborId(state, 's1', 'q2', 1)).toBe('q3')
    expect(selectQueueNeighborId(state, 's1', 'q1', -1)).toBeNull()
    expect(selectQueueNeighborId(state, 's1', 'q3', 1)).toBeNull()
  })
})
