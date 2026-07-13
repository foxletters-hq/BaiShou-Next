import { describe, expect, it } from 'vitest'
import { classifyIncrementalSyncPaths } from '../incremental-sync-path-classify.util'

describe('classifyIncrementalSyncPaths', () => {
  it('classifies journals, sessions, settings, summaries, assistants', () => {
    const result = classifyIncrementalSyncPaths([
      'Personal/Journals/2026/07/14.md',
      'Work/Sessions/abc123.json',
      'Personal/.baishou/settings/user_profile.json',
      'Personal/Summaries/week.md',
      'Personal/Assistants/latte.json'
    ])
    expect(result.journals).toBe(true)
    expect(result.sessions).toBe(true)
    expect(result.settings).toBe(true)
    expect(result.summaries).toBe(true)
    expect(result.assistants).toBe(true)
    expect(result.sessionRefs).toEqual([{ vaultName: 'Work', sessionId: 'abc123' }])
  })
})
