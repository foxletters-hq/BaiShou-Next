import { describe, expect, it } from 'vitest'
import { AgentGateKind, AgentGateRequestStatus, type AgentGateRequest } from '@baishou/shared'
import {
  mergeWorkspaceChangeEntries,
  workspaceChangeFromGatePreview,
  workspaceChangesFromGateRequest
} from '../workspace-gate-file-changes.util'

function request(previews: Array<{ path: string; diff: string }>): AgentGateRequest {
  const files = previews.map((item) => ({
    type: 'file_change' as const,
    path: item.path,
    kind: 'create' as const,
    additions: 1,
    deletions: 0,
    diff: item.diff
  }))
  return {
    id: 'bag_1',
    sessionId: 's1',
    vaultName: 'Personal',
    status: AgentGateRequestStatus.Pending,
    kind: AgentGateKind.Tool,
    action: 'workspace_write',
    title: '写入',
    options: [],
    allowCustomInput: false,
    metadata: {},
    createdAt: 1,
    preview: files[0],
    previews: files
  }
}

describe('workspaceChangesFromGateRequest', () => {
  it('should turn every coalesced write preview into a diff entry', () => {
    const changes = workspaceChangesFromGateRequest(
      request([
        { path: 'a.md', diff: '+a' },
        { path: 'b.md', diff: '+b' }
      ])
    )
    expect(changes.map((item) => item.path)).toEqual(['a.md', 'b.md'])
    expect(changes[1]?.data.diff).toBe('+b')
  })
})

describe('workspaceChangeFromGatePreview', () => {
  it('should pick the matching file when the card row is clicked', () => {
    const pending = request([
      { path: 'a.md', diff: '+a' },
      { path: 'b.md', diff: '+b' }
    ])
    expect(workspaceChangeFromGatePreview(pending, { path: 'b.md' })?.data.diff).toBe('+b')
  })
})

describe('mergeWorkspaceChangeEntries', () => {
  it('should prefer the gate unified diff when the tool entry only has a synthetic patch', () => {
    const merged = mergeWorkspaceChangeEntries(
      [
        {
          id: 'tool:a',
          path: 'a.md',
          kind: 'create',
          additions: 1,
          deletions: 0,
          data: { path: 'a.md', kind: 'create', additions: 1, deletions: 0, diff: '+old' }
        }
      ],
      workspaceChangesFromGateRequest(request([{ path: 'a.md', diff: '+new' }]))
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]?.data.diff).toBe('+new')
  })
})
