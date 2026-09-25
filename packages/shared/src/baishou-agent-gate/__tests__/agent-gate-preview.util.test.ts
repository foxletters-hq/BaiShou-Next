import { describe, expect, it } from 'vitest'
import type { AgentGateFileChangePreview } from '../agent-gate-preview.types'
import {
  listAgentGateFileChangePreviews,
  mergeAgentGatePreviews,
  shouldDisableAlwaysForRequest
} from '../agent-gate-preview.types'

function filePreview(
  path: string,
  extra: Partial<AgentGateFileChangePreview> = {}
): AgentGateFileChangePreview {
  return {
    type: 'file_change',
    path,
    kind: 'create',
    additions: 1,
    deletions: 0,
    diff: `+${path}`,
    ...extra
  }
}

describe('mergeAgentGatePreviews', () => {
  it('should keep every file preview when writes are merged', () => {
    const merged = mergeAgentGatePreviews(
      { preview: filePreview('a.md') },
      { preview: filePreview('b.md') }
    )
    expect(listAgentGateFileChangePreviews({ previews: merged }).map((item) => item.path)).toEqual([
      'a.md',
      'b.md'
    ])
  })

  it('should replace the earlier preview when the same path is written again', () => {
    const merged = mergeAgentGatePreviews(
      { preview: filePreview('a.md', { diff: '+old' }) },
      { preview: filePreview('a.md', { diff: '+new' }) }
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ path: 'a.md', diff: '+new' })
  })
})

describe('shouldDisableAlwaysForRequest', () => {
  it('should hide Always when a later coalesced file preview is truncated', () => {
    expect(
      shouldDisableAlwaysForRequest({
        preview: filePreview('a.md'),
        previews: [filePreview('a.md'), filePreview('b.md', { truncated: true })]
      })
    ).toBe(true)
  })
})
