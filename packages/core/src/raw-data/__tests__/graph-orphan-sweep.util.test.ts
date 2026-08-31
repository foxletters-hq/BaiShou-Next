import { describe, expect, it } from 'vitest'
import {
  collectAbsentDeleteIds,
  collectPresentMonths,
  parseGraphDeletedShardPath,
  shouldAbsentDelete
} from '../graph-orphan-sweep.util'

describe('graph-orphan-sweep.util', () => {
  it('parses diary and notebook deleted shard paths', () => {
    expect(parseGraphDeletedShardPath('Graph/nodes/2026-07.jsonl')).toEqual({
      collection: 'nodes',
      shardMonth: '2026-07'
    })
    expect(parseGraphDeletedShardPath('Vault/Graph/edges/2025-01.jsonl')).toEqual({
      collection: 'edges',
      shardMonth: '2025-01'
    })
    expect(parseGraphDeletedShardPath('Notebooks/nb1/graph/nodes/src_abc.jsonl')).toEqual({
      collection: 'nodes',
      shardMonth: 'src_abc',
      notebookId: 'nb1'
    })
    expect(parseGraphDeletedShardPath('Notebooks/nb1/graph/nodes/2026-03.jsonl')).toBeNull()
    expect(parseGraphDeletedShardPath('Notebooks/nb1/graph/nodes/_legacy.jsonl')).toBeNull()
    expect(parseGraphDeletedShardPath('Journals/2026-07-01.md')).toBeNull()
    expect(parseGraphDeletedShardPath('Graph/nodes/notes.md')).toBeNull()
  })

  it('treats deletedLocal paths as present-and-empty months', () => {
    const months = collectPresentMonths({
      shardMonths: ['2026-08'],
      deletedPaths: ['Graph/nodes/2026-01.jsonl', 'Notebooks/nb1/graph/nodes/2026-02.jsonl'],
      collection: 'nodes'
    })
    expect([...months].sort()).toEqual(['2026-01', '2026-08'])
  })

  it('scopes notebook deleted paths to the matching notebook', () => {
    const months = collectPresentMonths({
      shardMonths: ['src_keep'],
      deletedPaths: [
        'Notebooks/nb1/graph/nodes/src_a.jsonl',
        'Notebooks/nb2/graph/nodes/src_b.jsonl',
        'Notebooks/nb1/graph/nodes/_legacy.jsonl'
      ],
      collection: 'nodes',
      notebookId: 'nb1'
    })
    expect([...months].sort()).toEqual(['src_a', 'src_keep'])
  })

  it('keeps rows whose shard file is not present', () => {
    const live = new Set(['n-live'])
    const present = new Set(['2026-07'])
    expect(
      shouldAbsentDelete({
        id: 'ghost-old',
        shardMonth: '2026-01',
        liveIds: live,
        presentMonths: present
      })
    ).toBe(false)
    expect(
      shouldAbsentDelete({
        id: 'ghost-present',
        shardMonth: '2026-07',
        liveIds: live,
        presentMonths: present
      })
    ).toBe(true)
    expect(
      shouldAbsentDelete({
        id: 'n-live',
        shardMonth: '2026-07',
        liveIds: live,
        presentMonths: present
      })
    ).toBe(false)
    expect(
      shouldAbsentDelete({
        id: 'no-month',
        shardMonth: '',
        liveIds: live,
        presentMonths: present
      })
    ).toBe(false)
    expect(
      shouldAbsentDelete({
        id: 'legacy-only',
        shardMonth: '_legacy',
        liveIds: live,
        presentMonths: new Set(['_legacy', 'src_a'])
      })
    ).toBe(false)
  })

  it('collects only absent ids on present shards', () => {
    expect(
      collectAbsentDeleteIds(
        [
          { id: 'keep-live', shardMonth: '2026-07' },
          { id: 'drop', shardMonth: '2026-07' },
          { id: 'keep-unseen', shardMonth: '2026-01' }
        ],
        new Set(['keep-live']),
        new Set(['2026-07'])
      )
    ).toEqual(['drop'])
  })
})
