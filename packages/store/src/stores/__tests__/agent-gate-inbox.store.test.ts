import { beforeEach, describe, expect, it } from 'vitest'
import type { AgentGateRequest } from '@baishou/shared'
import { AgentGateKind, AgentGateRequestStatus } from '@baishou/shared'
import {
  clearAgentGateInboxTombstonesForTests,
  selectActivePendingForSession,
  selectQueuePosition,
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
    useAgentGateInboxStore.getState().upsertAsked(req({ id: 'b', sessionId: 's1', createdAt: 20 }))
    useAgentGateInboxStore.getState().upsertAsked(req({ id: 'a', sessionId: 's1', createdAt: 10 }))
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'b', sessionId: 's1', createdAt: 20, title: 'updated' }))
    const pending = useAgentGateInboxStore.getState().pending
    expect(pending.map((r) => r.id)).toEqual(['a', 'b'])
    expect(pending[1]?.title).toBe('updated')
  })

  it('removes replied precisely and advances active request', () => {
    useAgentGateInboxStore
      .getState()
      .hydrate([
        req({ id: 'a', sessionId: 's1', createdAt: 1 }),
        req({ id: 'b', sessionId: 's1', createdAt: 2 }),
        req({ id: 'c', sessionId: 's2', createdAt: 3 })
      ])
    expect(selectActivePendingForSession(useAgentGateInboxStore.getState(), 's1')?.id).toBe('a')
    useAgentGateInboxStore.getState().removeReplied('a')
    const next = useAgentGateInboxStore.getState()
    expect(selectActivePendingForSession(next, 's1')?.id).toBe('b')
    expect(selectQueuePosition(next, 's1', 'b')).toEqual({ index: 1, total: 1 })
    expect(next.pending.map((r) => r.id)).toEqual(['b', 'c'])
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
      .upsertAsked(req({ id: 'old', sessionId: 's1', createdAt: 10 }))
    const snapshotIdsAtFetchStart = new Set(
      useAgentGateInboxStore.getState().pending.map((item) => item.id)
    )
    useAgentGateInboxStore
      .getState()
      .upsertAsked(req({ id: 'live', sessionId: 's1', createdAt: 50 }))
    useAgentGateInboxStore
      .getState()
      .hydrate([req({ id: 'old', sessionId: 's1', createdAt: 10 })], {
        snapshotIdsAtFetchStart
      })
    expect(useAgentGateInboxStore.getState().pending.map((r) => r.id)).toEqual(['old', 'live'])
  })

  it('does not resurrect ids removed during fetch via stale listPending', () => {
    useAgentGateInboxStore.getState().upsertAsked(req({ id: 'a', sessionId: 's1', createdAt: 1 }))
    useAgentGateInboxStore.getState().upsertAsked(req({ id: 'b', sessionId: 's1', createdAt: 2 }))
    const snapshotIdsAtFetchStart = new Set(
      useAgentGateInboxStore.getState().pending.map((item) => item.id)
    )
    useAgentGateInboxStore.getState().removeReplied('a')
    useAgentGateInboxStore
      .getState()
      .hydrate(
        [
          req({ id: 'a', sessionId: 's1', createdAt: 1 }),
          req({ id: 'b', sessionId: 's1', createdAt: 2 })
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
    ).toBe(2)
  })
})
