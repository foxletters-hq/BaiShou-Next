import { describe, expect, it, vi } from 'vitest'
import {
  collectAgentGatePendingLookupKeys,
  loadAgentGatePendingNameMaps,
  lookupAgentGatePendingName,
  truncateAgentGateId
} from '../agent-gate-pending-labels.util'

describe('truncateAgentGateId', () => {
  it('should keep a short id unchanged when it is at most 12 characters', () => {
    expect(truncateAgentGateId('abc')).toBe('abc')
    expect(truncateAgentGateId('123456789012')).toBe('123456789012')
  })

  it('should truncate a long id to the first 10 characters plus an ellipsis', () => {
    expect(truncateAgentGateId('2f80f995-f123-4567')).toBe('2f80f995-f…')
  })
})

describe('lookupAgentGatePendingName', () => {
  it('should return the mapped name when it exists', () => {
    expect(lookupAgentGatePendingName('ws-1', { 'ws-1': '写作' })).toBe('写作')
  })

  it('should fall back to a truncated id when the name is missing', () => {
    expect(lookupAgentGatePendingName('a1e94e8f-e77c-447b-9233-6b7063ef1c47', {})).toBe(
      'a1e94e8f-e…'
    )
  })
})

describe('collectAgentGatePendingLookupKeys', () => {
  it('should collect unique workspace ids and session ids from pending groups', () => {
    expect(
      collectAgentGatePendingLookupKeys([
        {
          sessionId: 's-1',
          scope: { kind: 'workspace', workspaceId: 'ws-1' }
        },
        {
          sessionId: 's-1',
          scope: { kind: 'workspace', workspaceId: 'ws-1' }
        },
        {
          sessionId: 's-2',
          scope: { kind: 'companion' }
        }
      ])
    ).toEqual({
      workspaceIds: ['ws-1'],
      sessionIds: ['s-1', 's-2']
    })
  })
})

describe('loadAgentGatePendingNameMaps', () => {
  it('should map workspace display names and prefer listSessions titles', async () => {
    const maps = await loadAgentGatePendingNameMaps(
      { workspaceIds: ['ws-1'], sessionIds: ['s-1', 's-2'] },
      {
        listWorkspaces: async () => [{ id: 'ws-1', displayName: '写作' }],
        listSessions: async () => [{ sessionId: 's-1', title: '整理大纲' }],
        getSession: async (sessionId) => (sessionId === 's-2' ? { title: '日记回顾' } : null),
        untitledSession: '未命名会话'
      }
    )

    expect(maps.workspaceNames).toEqual({ 'ws-1': '写作' })
    expect(maps.sessionTitles).toEqual({
      's-1': '整理大纲',
      's-2': '日记回顾'
    })
  })

  it('should use the untitled fallback when a session exists but has an empty title', async () => {
    const getSession = vi.fn(async () => ({ title: '   ' }))
    const maps = await loadAgentGatePendingNameMaps(
      { workspaceIds: [], sessionIds: ['s-empty'] },
      {
        listWorkspaces: async () => [],
        listSessions: async () => [],
        getSession,
        untitledSession: '未命名会话'
      }
    )

    expect(maps.sessionTitles).toEqual({ 's-empty': '未命名会话' })
    expect(getSession).toHaveBeenCalledWith('s-empty')
  })

  it('should skip getSession when listSessions already resolved the title', async () => {
    const getSession = vi.fn(async () => ({ title: 'should-not-run' }))
    await loadAgentGatePendingNameMaps(
      { workspaceIds: [], sessionIds: ['s-1'] },
      {
        listWorkspaces: async () => [],
        listSessions: async () => [{ sessionId: 's-1', title: '已有标题' }],
        getSession,
        untitledSession: '未命名会话'
      }
    )
    expect(getSession).not.toHaveBeenCalled()
  })

  it('should keep maps empty when lookups fail so the UI can fall back to ids', async () => {
    const maps = await loadAgentGatePendingNameMaps(
      { workspaceIds: ['ws-1'], sessionIds: ['s-1'] },
      {
        listWorkspaces: async () => {
          throw new Error('workspaces unavailable')
        },
        listSessions: async () => {
          throw new Error('sessions unavailable')
        },
        getSession: async () => {
          throw new Error('session unavailable')
        },
        untitledSession: '未命名会话'
      }
    )

    expect(maps).toEqual({ workspaceNames: {}, sessionTitles: {} })
  })
})
