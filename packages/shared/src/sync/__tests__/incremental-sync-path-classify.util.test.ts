import { describe, expect, it } from 'vitest'
import { classifyIncrementalSyncPaths } from '../incremental-sync-path-classify.util'

describe('classifyIncrementalSyncPaths', () => {
  it('classifies journals, sessions, settings, summaries, assistants, memory, graph, notebooks', () => {
    const result = classifyIncrementalSyncPaths([
      'Personal/Journals/2026/07/14.md',
      'Work/Sessions/abc123.json',
      'Personal/.baishou/settings/user_profile.json',
      '.baishou/settings/ai_providers.json',
      'Personal/Summaries/week.md',
      'Personal/Assistants/latte.json',
      'Personal/Memory/2026-07.jsonl',
      'Personal/Graph/nodes/2026-07.jsonl',
      'Personal/Notebooks/notebooks.jsonl',
      'Personal/Notebooks/nb1/extracted/src1.md'
    ])
    expect(result.journals).toBe(true)
    expect(result.sessions).toBe(true)
    expect(result.settings).toBe(true)
    expect(result.summaries).toBe(true)
    expect(result.assistants).toBe(true)
    expect(result.memory).toBe(true)
    expect(result.graph).toBe(true)
    expect(result.notebooks).toBe(true)
    expect(result.notebookGraphIds).toEqual([])
    expect(result.sessionRefs).toEqual([{ vaultName: 'Work', sessionId: 'abc123' }])
  })

  it('只收集命中 Notebooks/<id>/graph/ 的本子 id', () => {
    const result = classifyIncrementalSyncPaths([
      'Personal/Notebooks/nb1/graph/nodes/2026-08.jsonl',
      'Personal/Notebooks/nb1/graph/edges/2026-08.jsonl',
      'Personal/Notebooks/nb2/extracted/src1.md',
      'Work/Notebooks/nb3/graph/extract-state/2026-08.jsonl'
    ])
    expect(result.notebooks).toBe(true)
    expect(result.notebookGraphIds).toEqual(['nb1', 'nb3'])
  })
})
