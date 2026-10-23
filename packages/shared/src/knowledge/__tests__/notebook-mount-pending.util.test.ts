import { describe, expect, it } from 'vitest'
import {
  getPendingMountedNotebookIds,
  isDraftNotebookMountSessionId,
  notebookMountPendingKey,
  setPendingMountedNotebookIds,
  shouldShowSessionContextUsageRing,
  takePendingMountedNotebookIds
} from '../notebook-mount-pending.util'

describe('notebook mount pending', () => {
  it('should treat empty and new-session ids as draft', () => {
    expect(isDraftNotebookMountSessionId(undefined)).toBe(true)
    expect(isDraftNotebookMountSessionId('new-session')).toBe(true)
    expect(isDraftNotebookMountSessionId('new-1710000000000')).toBe(true)
    expect(isDraftNotebookMountSessionId('sess_1')).toBe(false)
  })

  it('should keep draft mounts until they are taken for a real session', () => {
    const key = notebookMountPendingKey({
      sessionId: 'new-session',
      assistantId: 'ast_1',
      scope: 'companion'
    })
    expect(setPendingMountedNotebookIds(key, ['nb_1', 'nb_2'])).toEqual(['nb_1', 'nb_2'])
    expect(getPendingMountedNotebookIds(key)).toEqual(['nb_1', 'nb_2'])
    expect(takePendingMountedNotebookIds(key)).toEqual(['nb_1', 'nb_2'])
    expect(getPendingMountedNotebookIds(key)).toEqual([])
  })

  it('should hide the context ring when no conversation messages exist', () => {
    expect(shouldShowSessionContextUsageRing({ messageCount: 0 })).toBe(false)
    expect(shouldShowSessionContextUsageRing({ messageCount: 1 })).toBe(true)
    expect(shouldShowSessionContextUsageRing({ messageCount: 2, hidden: true })).toBe(false)
  })
})
