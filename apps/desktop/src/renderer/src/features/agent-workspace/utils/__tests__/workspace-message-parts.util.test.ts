import { describe, expect, it } from 'vitest'
import type { FileChangePartData } from '@baishou/shared'
import {
  buildFileOpEntries,
  collectWorkspaceFileChanges,
  extractToolInvocations,
  groupStreamTimelineItems,
  groupWorkspaceAssistantTimeline,
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

  it('groups consecutive tools into one compact section', () => {
    const groups = groupWorkspaceAssistantTimeline([
      { kind: 'text', key: 't1', text: 'start' },
      {
        kind: 'tool',
        key: 'tool-1',
        invocation: {
          toolCallId: 'c1',
          toolName: 'workspace_read',
          state: 'result',
          args: { path: 'a.md' },
          result: 'ok'
        }
      },
      {
        kind: 'tool',
        key: 'tool-2',
        invocation: {
          toolCallId: 'c2',
          toolName: 'workspace_list',
          state: 'result',
          args: { path: '.' },
          result: 'ok'
        }
      },
      { kind: 'text', key: 't2', text: 'done' }
    ])

    expect(groups.map((group) => group.kind)).toEqual(['text', 'tools', 'text'])
    expect(groups[1]).toMatchObject({
      kind: 'tools',
      invocations: [{ toolName: 'workspace_read' }, { toolName: 'workspace_list' }]
    })
  })

  it('merges writes and file changes into one collapsed file op group', () => {
    const groups = groupWorkspaceAssistantTimeline([
      {
        kind: 'tool',
        key: 'tool-1',
        invocation: {
          toolCallId: 'c1',
          toolName: 'workspace_write',
          state: 'result',
          args: { path: 'a.md', content: 'hi' },
          result: 'ok'
        }
      },
      {
        kind: 'file_change',
        key: 'f1',
        data: { path: 'a.md', kind: 'create', additions: 1, deletions: 0, toolCallId: 'c1', diff: '+hi' }
      },
      {
        kind: 'tool',
        key: 'tool-2',
        invocation: {
          toolCallId: 'c2',
          toolName: 'workspace_write',
          state: 'result',
          args: { path: 'b.md', content: 'yo' },
          result: 'ok'
        }
      }
    ])

    expect(groups.map((group) => group.kind)).toEqual(['file_ops'])
    expect(groups[0]).toMatchObject({
      kind: 'file_ops',
      invocations: [{ toolCallId: 'c1' }, { toolCallId: 'c2' }],
      items: [{ key: 'f1' }]
    })
  })

  it('groups consecutive successful file changes and keeps failures separate', () => {
    const groups = groupWorkspaceAssistantTimeline([
      { kind: 'text', key: 't1', text: 'done' },
      {
        kind: 'file_change',
        key: 'f1',
        data: { path: 'a.ts', kind: 'modify', additions: 2, deletions: 1 }
      },
      {
        kind: 'file_change',
        key: 'f2',
        data: { path: 'b.ts', kind: 'create', additions: 4, deletions: 0 }
      },
      {
        kind: 'file_change',
        key: 'f3',
        data: {
          path: 'c.ts',
          kind: 'modify',
          additions: 1,
          deletions: 0,
          status: 'failed'
        } as FileChangePartData
      },
      {
        kind: 'file_change',
        key: 'f4',
        data: { path: 'd.ts', kind: 'delete', additions: 0, deletions: 3 }
      }
    ])

    expect(groups.map((group) => group.kind)).toEqual([
      'text',
      'file_ops',
      'file_change_failed',
      'file_ops'
    ])
    expect(groups[1]).toMatchObject({
      kind: 'file_ops',
      items: [{ key: 'f1' }, { key: 'f2' }]
    })
    expect(groups[3]).toMatchObject({
      kind: 'file_ops',
      items: [{ key: 'f4' }]
    })
  })

  it('groups consecutive stream tools and splits file mutations', () => {
    const groups = groupStreamTimelineItems([
      { kind: 'text', text: 'hi' },
      {
        kind: 'tool',
        callId: 'c1',
        name: 'workspace_read',
        status: 'completed',
        arguments: { path: 'a.md' },
        result: 'ok'
      },
      {
        kind: 'tool',
        callId: 'c2',
        name: 'workspace_write',
        status: 'running',
        arguments: { path: 'b.md', content: 'x' }
      }
    ])

    expect(groups.map((group) => group.kind)).toEqual(['text', 'tools', 'file_ops'])
    expect(groups[1]).toMatchObject({
      kind: 'tools',
      items: [{ callId: 'c1' }]
    })
    expect(groups[2]).toMatchObject({
      kind: 'file_ops',
      items: [{ callId: 'c2' }]
    })
  })

  it('prefers file_change diff when matching a write tool', () => {
    const entries = buildFileOpEntries(
      'm1',
      [
        {
          toolCallId: 'c1',
          toolName: 'workspace_write',
          state: 'result',
          args: { path: 'a.md', content: 'new' },
          result: 'ok'
        }
      ],
      [{ path: 'a.md', kind: 'create', additions: 3, deletions: 0, toolCallId: 'c1', diff: '+a\n+b\n+c' }]
    )

    expect(entries).toHaveLength(1)
    expect(entries[0]?.data.diff).toBe('+a\n+b\n+c')
    expect(entries[0]?.additions).toBe(3)
  })
})
