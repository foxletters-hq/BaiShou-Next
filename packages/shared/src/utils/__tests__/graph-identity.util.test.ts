import { describe, expect, it } from 'vitest'
import {
  entryNodeIdForFilePath,
  graphEdgeId,
  graphNodeIdForEntity,
  legacyEntryNodeIdForFilePath,
  normalizeGraphName,
  pickExactGraphNameHit,
  preferGraphOrigin,
  resolveExactGraphNodeHit,
  shouldKeepIncomingGraphNodeId
} from '../graph-identity.util'
import { graphDiaryInstant } from '../graph-time.util'
import { GRAPH_GLOBAL_MAX_NODES } from '../graph-view.constants'

describe('normalizeGraphName', () => {
  it('trims, collapses whitespace, lowercases', () => {
    expect(normalizeGraphName('  Xiao  Ming ')).toBe('xiao ming')
  })
})

describe('entryNodeIdForFilePath', () => {
  it('normalizes path separators', () => {
    const a = entryNodeIdForFilePath('Journals/2026-07-01.md')
    const b = entryNodeIdForFilePath('Journals\\2026-07-01.md')
    expect(a).toBe(b)
    expect(a).toBe(legacyEntryNodeIdForFilePath('Journals/2026-07-01.md'))
  })

  it('differs across vaults', () => {
    const path = 'Journals/2026-07-01.md'
    const a = entryNodeIdForFilePath(path, 'vlt_aaaaaaaaaaaaaaaa')
    const b = entryNodeIdForFilePath(path, 'vlt_bbbbbbbbbbbbbbbb')
    expect(a).not.toBe(b)
  })
})

describe('graphNodeIdForEntity', () => {
  it('is stable for same vault+type+name', () => {
    const a = graphNodeIdForEntity('vlt_a', 'person', '小明')
    const b = graphNodeIdForEntity('vlt_a', 'person', '  小明  ')
    expect(a).toBe(b)
  })

  it('differs across vaults and types', () => {
    const a = graphNodeIdForEntity('vlt_a', 'person', '小明')
    const b = graphNodeIdForEntity('vlt_b', 'person', '小明')
    const c = graphNodeIdForEntity('vlt_a', 'place', '小明')
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })
})

describe('shouldKeepIncomingGraphNodeId', () => {
  it('keeps the content-addressable id from either side', () => {
    const vaultId = 'vlt_aaaaaaaaaaaaaaaa'
    const stable = graphNodeIdForEntity(vaultId, 'person', '小明')
    expect(
      shouldKeepIncomingGraphNodeId({
        vaultId,
        nodeType: 'person',
        name: '小明',
        incomingId: stable,
        existingId: 'legacy-random'
      })
    ).toBe(true)
    expect(
      shouldKeepIncomingGraphNodeId({
        vaultId,
        nodeType: 'person',
        name: '小明',
        incomingId: 'legacy-random',
        existingId: stable
      })
    ).toBe(false)
  })
})

describe('graphEdgeId', () => {
  it('is content-addressable for same endpoints+source', () => {
    const a = graphEdgeId('vlt_a', 'n1', 'n2', 'mentions', '2026-07-01')
    const b = graphEdgeId('vlt_a', 'n1', 'n2', 'mentions', '2026-07-01')
    expect(a).toBe(b)
  })

  it('changes when sourceRef differs', () => {
    const a = graphEdgeId('vlt_a', 'n1', 'n2', 'mentions', '2026-07-01')
    const b = graphEdgeId('vlt_a', 'n1', 'n2', 'mentions', '2026-07-02')
    expect(a).not.toBe(b)
  })
})

describe('graphDiaryInstant', () => {
  it('parses YYYY-MM-DD from path', () => {
    const r = graphDiaryInstant('Journals/2026-03-15.md')
    expect(r.dateStr).toBe('2026-03-15')
    expect(r.shardMonth).toBe('2026-03')
    expect(r.validFrom).toBe(new Date(2026, 2, 15).getTime())
  })

  it('parses date-only sourceRef', () => {
    const r = graphDiaryInstant('2024-07-01')
    expect(r.shardMonth).toBe('2024-07')
    expect(r.dateStr).toBe('2024-07-01')
  })
})

describe('GRAPH_GLOBAL_MAX_NODES', () => {
  it('is 200', () => {
    expect(GRAPH_GLOBAL_MAX_NODES).toBe(200)
  })
})

describe('pickExactGraphNameHit', () => {
  const hits = [
    { id: 'n-ming', name: '小明', aliases: ['小明同学'] },
    { id: 'n-hong', name: '小红', aliases: [] }
  ]

  it('matches normalized name or alias', () => {
    expect(pickExactGraphNameHit(hits, '  小明  ')?.id).toBe('n-ming')
    expect(pickExactGraphNameHit(hits, '小明同学')?.id).toBe('n-ming')
  })

  it('does not reuse a partial or first similar hit', () => {
    expect(pickExactGraphNameHit(hits, '明')).toBeNull()
    expect(pickExactGraphNameHit(hits, '小')).toBeNull()
    expect(pickExactGraphNameHit(hits, '小明哥')).toBeNull()
  })
})

describe('resolveExactGraphNodeHit', () => {
  it('returns null when equality lookup misses', async () => {
    const hit = await resolveExactGraphNodeHit(
      { name: '明' },
      {
        findByNameOrAlias: async () => null
      }
    )
    expect(hit).toBeNull()
  })

  it('uses typed name-or-alias equality', async () => {
    const hit = await resolveExactGraphNodeHit(
      { name: '小明同学', nodeType: 'person' },
      {
        findByNameOrAlias: async (_name, nodeType) =>
          nodeType === 'person' ? { id: 'n-ming', name: '小明', aliases: ['小明同学'] } : null
      }
    )
    expect(hit?.id).toBe('n-ming')
  })
})

describe('preferGraphOrigin', () => {
  it('keeps existing user against incoming ai', () => {
    expect(preferGraphOrigin('user', 'ai')).toBe('user')
  })

  it('upgrades ai to user', () => {
    expect(preferGraphOrigin('ai', 'user')).toBe('user')
  })

  it('defaults new nodes to incoming or ai', () => {
    expect(preferGraphOrigin(undefined, 'ai')).toBe('ai')
    expect(preferGraphOrigin(undefined, undefined)).toBe('ai')
  })
})
