import { describe, it, expect } from 'vitest'
import {
  sortDiariesByDateAsc,
  sortDiariesByDateDesc,
  filterUnindexedDiaries,
  buildDiaryEmbeddingSourceId,
  buildDiaryEmbeddingGroupId,
  isLegacyDiaryEmbeddingSourceId,
  buildDiaryEmbeddingDatePrefix,
  buildDiaryEmbeddingTextArgs,
  aggregateEmbedLedgerFromVectorRows,
  extractEmbedContentHashFromMetadata,
  mergeEmbedContentHashIntoMetadata,
  hashEmbedSourceContent,
  toDiaryEmbedDetectionRow,
  countPendingMemoriesAgainstLedger,
  isDiaryRagEntry,
  isRagEntryEditable
} from '../rag-diary.util'

describe('记忆中心条目的来源判断', () => {
  it('只有 diary 算日记来源', () => {
    expect(isDiaryRagEntry('diary')).toBe(true)
    expect(isDiaryRagEntry('memory')).toBe(false)
    expect(isDiaryRagEntry('manual')).toBe(false)
    expect(isDiaryRagEntry('chat')).toBe(false)
    expect(isDiaryRagEntry(undefined)).toBe(false)
  })

  it('日记切片不可编辑，其余来源可编辑', () => {
    expect(isRagEntryEditable('diary')).toBe(false)
    expect(isRagEntryEditable('graph_node')).toBe(false)
    expect(isRagEntryEditable('memory')).toBe(true)
    expect(isRagEntryEditable('manual')).toBe(true)
    expect(isRagEntryEditable('chat')).toBe(true)
    expect(isRagEntryEditable(undefined)).toBe(true)
  })
})

describe('sortDiariesByDateAsc', () => {
  it('sorts diaries oldest first for batch embed without mutating input', () => {
    const diaries = [
      { id: 1, date: new Date('2024-01-01') },
      { id: 2, date: new Date('2026-06-01') },
      { id: 3, date: new Date('2025-03-15') }
    ]

    const sorted = sortDiariesByDateAsc(diaries)

    expect(sorted.map((d) => d.id)).toEqual([1, 3, 2])
    expect(diaries.map((d) => d.id)).toEqual([1, 2, 3])
  })
})

describe('sortDiariesByDateDesc', () => {
  it('sorts diaries newest first for display without mutating input', () => {
    const diaries = [
      { id: 1, date: new Date('2024-01-01') },
      { id: 2, date: new Date('2026-06-01') },
      { id: 3, date: new Date('2025-03-15') }
    ]

    const sorted = sortDiariesByDateDesc(diaries)

    expect(sorted.map((d) => d.id)).toEqual([2, 3, 1])
  })
})

describe('buildDiaryEmbeddingDatePrefix', () => {
  it('formats local calendar date without tag metadata', () => {
    expect(buildDiaryEmbeddingDatePrefix(new Date(2026, 8, 1))).toBe('[2026-09-01 日记:]\n')
    expect(buildDiaryEmbeddingDatePrefix('2026-09-01')).toBe('[2026-09-01 日记:]\n')
    expect(buildDiaryEmbeddingDatePrefix('not-a-date')).toBe('')
  })
})

describe('buildDiaryEmbeddingTextArgs', () => {
  it('uses diary body as text and only adds a date prefix', () => {
    expect(buildDiaryEmbeddingTextArgs('开会纪要 #工作', '2026-09-01')).toEqual({
      text: '开会纪要 #工作',
      chunkPrefix: '[2026-09-01 日记:]\n'
    })
    expect(buildDiaryEmbeddingTextArgs('开会纪要', '2026-09-01').chunkPrefix).not.toContain('标签')
    expect(buildDiaryEmbeddingTextArgs('开会纪要', 'not-a-date')).toEqual({
      text: '开会纪要',
      chunkPrefix: ''
    })
  })
})

describe('diary embedding keys', () => {
  it('builds vault-scoped source and group ids', () => {
    expect(buildDiaryEmbeddingSourceId('vlt_abc', 42)).toBe('vlt_abc#42')
    expect(buildDiaryEmbeddingGroupId('anything')).toBe('diary')
    expect(isLegacyDiaryEmbeddingSourceId('42')).toBe(true)
    expect(isLegacyDiaryEmbeddingSourceId('Personal#42')).toBe(false)
  })
})

describe('filterUnindexedDiaries', () => {
  it('includes diaries that have never been indexed', () => {
    const diaries = [
      { id: 1, updatedAt: new Date('2026-05-20T00:00:00Z') },
      { id: 2, updatedAt: new Date('2026-05-20T00:00:00Z') }
    ]
    const embeddedIds = new Set([buildDiaryEmbeddingSourceId('vlt_abc', 1)])
    const embeddedUpdatedAtMap = new Map<string, number>([
      [buildDiaryEmbeddingSourceId('vlt_abc', 1), new Date('2026-05-20T00:00:00Z').getTime()]
    ])

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap, {
      resolveSourceId: (d) => buildDiaryEmbeddingSourceId('vlt_abc', d.id)
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(2)
  })

  it('includes diaries modified after indexing', () => {
    const diaries = [
      { id: 1, updatedAt: new Date('2026-05-21T00:00:00Z') },
      { id: 2, updatedAt: new Date('2026-05-20T00:00:00Z') }
    ]
    const embeddedIds = new Set(['1', '2'])
    const embeddedUpdatedAtMap = new Map<string, number>([
      ['1', new Date('2026-05-20T00:00:00Z').getTime()],
      ['2', new Date('2026-05-20T00:00:00Z').getTime()]
    ])

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(1)
  })

  it('includes diaries indexed without updated_at metadata', () => {
    const diaries = [{ id: 1, updatedAt: new Date('2026-05-20T00:00:00Z') }]
    const embeddedIds = new Set(['1'])
    const embeddedUpdatedAtMap = new Map<string, number>()

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(1)
  })

  it('treats hash mismatch as pending even when updatedAt is smaller', () => {
    const older = new Date('2026-05-10T00:00:00Z')
    const newer = new Date('2026-05-20T00:00:00Z')
    const diaries = [{ id: 1, updatedAt: older, contentHash: 'hash-old' }]
    const embeddedIds = new Set(['1'])
    const embeddedUpdatedAtMap = new Map<string, number>([['1', newer.getTime()]])
    const embeddedContentHashMap = new Map<string, string>([['1', 'hash-new']])

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap, {
      embeddedContentHashMap
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(1)
  })

  it('falls back to time comparison when ledger has no hash', () => {
    const older = new Date('2026-05-10T00:00:00Z')
    const newer = new Date('2026-05-20T00:00:00Z')
    const diaries = [
      { id: 1, updatedAt: older, contentHash: 'hash-old' },
      { id: 2, updatedAt: newer, contentHash: 'hash-new' }
    ]
    const embeddedIds = new Set(['1', '2'])
    const embeddedUpdatedAtMap = new Map<string, number>([
      ['1', newer.getTime()],
      ['2', older.getTime()]
    ])

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap, {
      embeddedContentHashMap: new Map()
    })

    expect(result.map((d) => d.id)).toEqual([2])
  })

  it('does not treat journals_index file hash as embed body hash', () => {
    const body = '今天写了日记'
    const fileMarkdown = `---\nid: 1\nweather: sunny\n---\n${body}`
    const bodyHash = hashEmbedSourceContent(body)
    const fileHash = hashEmbedSourceContent(fileMarkdown)
    expect(fileHash).not.toBe(bodyHash)

    const detection = toDiaryEmbedDetectionRow({
      id: 1,
      date: '2026-05-10',
      updatedAt: '2026-05-10T00:00:00.000Z',
      rawContent: body
    })
    expect(detection.contentHash).toBe(bodyHash)
    expect(detection.contentHash).not.toBe(fileHash)

    const newer = new Date('2026-05-20T00:00:00.000Z')
    const result = filterUnindexedDiaries(
      [{ id: 1, updatedAt: newer, contentHash: fileHash }],
      new Set(['1']),
      new Map([['1', newer.getTime()]]),
      { embeddedContentHashMap: new Map([['1', bodyHash]]) }
    )
    expect(result).toHaveLength(1)
  })

  it('keeps matching hashes out of pending even if updatedAt shrinks', () => {
    const older = new Date('2026-05-10T00:00:00Z')
    const newer = new Date('2026-05-20T00:00:00Z')
    const diaries = [{ id: 1, updatedAt: older, contentHash: 'same' }]
    const embeddedIds = new Set(['1'])
    const embeddedUpdatedAtMap = new Map<string, number>([['1', newer.getTime()]])
    const embeddedContentHashMap = new Map<string, string>([['1', 'same']])

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap, {
      embeddedContentHashMap
    })

    expect(result).toHaveLength(0)
  })
})

describe('embed ledger metadata helpers', () => {
  it('writes and reads content_hash from metadata_json', () => {
    const merged = mergeEmbedContentHashIntoMetadata(
      JSON.stringify({ updated_at: 100 }),
      'deadbeef'
    )
    expect(JSON.parse(merged)).toEqual({ updated_at: 100, content_hash: 'deadbeef' })
    expect(extractEmbedContentHashFromMetadata(merged)).toBe('deadbeef')
  })

  it('merges legacy numeric and scoped diary source ids and recovers hashes', () => {
    const rows = aggregateEmbedLedgerFromVectorRows([
      {
        vaultId: 'vault-a',
        sourceType: 'diary',
        sourceId: '12',
        modelId: 'm1',
        dimension: 8,
        metadataJson: JSON.stringify({ content_hash: 'abc', updated_at: 10 })
      },
      {
        vaultId: 'vault-a',
        sourceType: 'diary',
        sourceId: 'vault-a#12',
        modelId: 'm1',
        dimension: 8,
        metadataJson: JSON.stringify({ content_hash: 'abc', updated_at: 20 })
      }
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      vaultId: 'vault-a',
      sourceType: 'diary',
      sourceId: 'vault-a#12',
      contentHash: 'abc',
      chunkCount: 2,
      modelId: 'm1',
      dimension: 8,
      updatedAt: 20
    })
    expect(rows.every((row) => row.contentHash)).toBe(true)
  })
})

describe('countPendingMemoriesAgainstLedger', () => {
  it('counts missing, hash-mismatched, and failed ledger rows', () => {
    const live = [
      { id: 'a', content: 'hello' },
      { id: 'b', content: 'world' },
      { id: 'c', content: 'same' }
    ]
    const ledger = new Map([
      { sourceId: 'b', contentHash: hashEmbedSourceContent('old'), status: 'embedded' },
      { sourceId: 'c', contentHash: hashEmbedSourceContent('same'), status: 'failed' }
    ].map((row) => [row.sourceId, { contentHash: row.contentHash, status: row.status }]))

    expect(countPendingMemoriesAgainstLedger(live, ledger)).toBe(3)
  })

  it('skips live rows whose ledger hash and status match', () => {
    const live = [{ id: 'a', content: 'hello' }]
    const ledger = new Map([
      ['a', { contentHash: hashEmbedSourceContent('hello'), status: 'embedded' }]
    ])
    expect(countPendingMemoriesAgainstLedger(live, ledger)).toBe(0)
  })
})
