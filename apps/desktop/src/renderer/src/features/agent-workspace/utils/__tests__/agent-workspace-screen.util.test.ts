import { describe, expect, it, vi } from 'vitest'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import {
  folderRegistryKey,
  isPersistedWorkspaceSessionId,
  nextBoundStreamSessionId,
  notifyWorkspaceSessionsChanged,
  openWorkspacePath,
  resolveActiveWorkspace,
  resolveLayoutScopeKey,
  shouldRegisterLooseFolder,
  toSessionModelMenuProviders,
  WORKSPACE_SESSIONS_CHANGED_EVENT
} from '../agent-workspace-screen.util'

function workspace(
  partial: Partial<AgentWorkspaceEntry> & Pick<AgentWorkspaceEntry, 'id'>
): AgentWorkspaceEntry {
  return {
    folderRoot: `D:/${partial.id}`,
    displayName: partial.id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial
  }
}

describe('openWorkspacePath', () => {
  it('should build the open route when a workspace id is given', () => {
    expect(openWorkspacePath('ws-1')).toBe('/agent-workspace/open/ws-1')
  })
})

describe('isPersistedWorkspaceSessionId', () => {
  it('should accept a real session id and reject the new-session placeholder', () => {
    expect(isPersistedWorkspaceSessionId('sess-1')).toBe(true)
    expect(isPersistedWorkspaceSessionId('new-session')).toBe(false)
    expect(isPersistedWorkspaceSessionId(undefined)).toBe(false)
  })
})

describe('resolveActiveWorkspace', () => {
  const list = [
    workspace({ id: 'ws-1', folderRoot: 'D:/alpha' }),
    workspace({ id: 'ws-2', folderRoot: 'D:/beta' })
  ]

  it('should prefer the store selection when it is already set', () => {
    expect(
      resolveActiveWorkspace({
        activeWorkspace: list[1],
        routeWorkspaceId: 'ws-1',
        workspaces: list,
        folderRoot: 'D:/alpha'
      })?.id
    ).toBe('ws-2')
  })

  it('should fall back to the route then the folder when no store selection exists', () => {
    expect(
      resolveActiveWorkspace({
        activeWorkspace: null,
        routeWorkspaceId: 'ws-1',
        workspaces: list,
        folderRoot: null
      })?.id
    ).toBe('ws-1')
    expect(
      resolveActiveWorkspace({
        activeWorkspace: null,
        workspaces: list,
        folderRoot: 'D:\\beta'
      })?.id
    ).toBe('ws-2')
  })
})

describe('nextBoundStreamSessionId', () => {
  it('should bind the route session when it is a persisted conversation', () => {
    expect(nextBoundStreamSessionId({ sessionId: 'sess-1', routeWorkspaceId: 'ws-1' })).toEqual({
      next: 'sess-1',
      replace: true
    })
  })

  it('should clear the bind when opening a workspace blank chat', () => {
    expect(nextBoundStreamSessionId({ sessionId: undefined, routeWorkspaceId: 'ws-1' })).toEqual({
      next: undefined,
      replace: true
    })
  })

  it('should leave the bind unchanged when neither a session nor an open route is present', () => {
    expect(nextBoundStreamSessionId({})).toEqual({ next: undefined, replace: false })
  })
})

describe('shouldRegisterLooseFolder', () => {
  it('should register only a loaded folder that is not already listed or synced', () => {
    expect(
      shouldRegisterLooseFolder({
        loadingWorkspaces: false,
        folderRoot: 'D:/proj',
        alreadyInList: false,
        alreadySynced: false
      })
    ).toBe(true)
    expect(
      shouldRegisterLooseFolder({
        loadingWorkspaces: true,
        folderRoot: 'D:/proj',
        alreadyInList: false,
        alreadySynced: false
      })
    ).toBe(false)
    expect(
      shouldRegisterLooseFolder({
        loadingWorkspaces: false,
        folderRoot: 'D:/proj',
        alreadyInList: true,
        alreadySynced: false
      })
    ).toBe(false)
  })
})

describe('folderRegistryKey', () => {
  it('should normalize slashes and case when hashing a folder root', () => {
    expect(folderRegistryKey('D:\\Proj')).toBe('d:/proj')
  })
})

describe('resolveLayoutScopeKey', () => {
  it('should prefer the route workspace then the selected workspace then the folder', () => {
    expect(
      resolveLayoutScopeKey({
        routeWorkspaceId: 'ws-1',
        workspaceId: 'ws-2',
        folderRoot: 'D:/x'
      })
    ).toBe('ws-1')
    expect(resolveLayoutScopeKey({ workspaceId: 'ws-2', folderRoot: 'D:/x' })).toBe('ws-2')
    expect(resolveLayoutScopeKey({ folderRoot: 'D:/x' })).toBe('D:/x')
  })
})

describe('toSessionModelMenuProviders', () => {
  it('should drop embedding models and empty providers when building the switcher list', () => {
    const providers = toSessionModelMenuProviders([
      {
        id: 'p1',
        name: 'Alpha',
        type: 'openai',
        models: ['gpt-4', 'text-embedding-3-small'],
        enabledModels: ['gpt-4', 'text-embedding-3-small']
      },
      {
        id: 'p2',
        enabledModels: ['text-embedding-3-small']
      }
    ])
    expect(providers).toEqual([
      {
        id: 'p1',
        name: 'Alpha',
        type: 'openai',
        models: ['gpt-4', 'text-embedding-3-small'],
        enabledModels: ['gpt-4']
      }
    ])
  })
})

describe('notifyWorkspaceSessionsChanged', () => {
  it('should dispatch the workspace sessions event when called', () => {
    const handler = vi.fn()
    window.addEventListener(WORKSPACE_SESSIONS_CHANGED_EVENT, handler)
    notifyWorkspaceSessionsChanged()
    window.removeEventListener(WORKSPACE_SESSIONS_CHANGED_EVENT, handler)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
