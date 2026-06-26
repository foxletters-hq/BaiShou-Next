import { describe, expect, it } from 'vitest'
import {
  collectWorkspaceFileChanges,
  extractToolInvocations,
  formatWorkspaceToolDisplayName,
  isFileChangeData
} from '../workspace-message-parts.util'

describe('workspace-message-parts.util', () => {
  it('detects file change data', () => {
    expect(isFileChangeData({ path: 'a.ts', kind: 'modify' })).toBe(true)
    expect(isFileChangeData({ path: 'a.ts' })).toBe(false)
  })

  it('extracts tool invocations from assistant parts', () => {
    const invocations = extractToolInvocations([
      {
        id: 'p1',
        messageId: 'm1',
        sessionId: 's1',
        type: 'tool',
        data: {
          callId: 'c1',
          name: 'workspace_read',
          result: 'ok'
        }
      }
    ])

    expect(invocations).toHaveLength(1)
    expect(invocations[0]?.toolName).toBe('workspace_read')
  })

  it('skips failed file change parts in change list', () => {
    const changes = collectWorkspaceFileChanges([
      {
        id: 'm1',
        role: 'assistant',
        parts: [
          {
            id: 'p1',
            messageId: 'm1',
            sessionId: 's1',
            type: 'file_change',
            data: { path: 'a.ts', kind: 'modify', additions: 1, deletions: 0, status: 'failed' }
          },
          {
            id: 'p2',
            messageId: 'm1',
            sessionId: 's1',
            type: 'file_change',
            data: { path: 'b.ts', kind: 'create', additions: 2, deletions: 0 }
          }
        ]
      }
    ])

    expect(changes).toHaveLength(1)
    expect(changes[0]?.path).toBe('b.ts')
  })

  it('formats mcp tool names for display', () => {
    expect(formatWorkspaceToolDisplayName('mcp__server__workspace_read')).toBe('workspace read')
  })
})
