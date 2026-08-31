import { describe, it, expect, vi } from 'vitest'
import {
  mergeJsonlRecordSides,
  pickWinner,
  JsonlRecordMergeService,
  parseJsonlText,
  sanitizeRecordTimestamps,
  JSONL_FUTURE_SKEW_MS
} from '../jsonl-record-merge.service'
import {
  applyJsonlConflictResolved,
  classifyMonthlyJsonlPath,
  isMonthlyJsonlRawPath,
  shouldLineMergeMonthlyJsonlOnConflict,
  shardKeyValidatorForJsonlKind
} from '../monthly-jsonl-path.util'

describe('jsonl-record-merge', () => {
  it('keeps rows unique to each side', () => {
    const merged = mergeJsonlRecordSides(
      [{ id: 'a', updatedAt: 1, v: 1 }],
      [{ id: 'b', updatedAt: 1, v: 2 }]
    )
    expect(merged.map((r) => r.id).sort()).toEqual(['a', 'b'])
  })

  it('same id uses higher updatedAt (LWW)', () => {
    const merged = mergeJsonlRecordSides(
      [{ id: 'a', updatedAt: 10, text: 'old' }],
      [{ id: 'a', updatedAt: 20, text: 'new' }]
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ text: 'new', updatedAt: 20 })
  })

  it('newer updatedAt keeps a decreased mentionCount', () => {
    const winner = pickWinner(
      { id: 'a', updatedAt: 10, mentionCount: 5 },
      { id: 'a', updatedAt: 11, mentionCount: 3 }
    )
    expect(winner).toMatchObject({ mentionCount: 3, updatedAt: 11 })
  })

  it('tombstone wins on equal updatedAt', () => {
    const winner = pickWinner(
      { id: 'a', updatedAt: 5, deletedAt: null, text: 'live' },
      { id: 'a', updatedAt: 5, deletedAt: 5, text: 'dead' }
    )
    expect(winner.deletedAt).toBe(5)
  })

  it('mergeTexts produces JSONL', () => {
    const svc = new JsonlRecordMergeService()
    const out = svc.mergeTexts('{"id":"a","updatedAt":1}\n', '{"id":"b","updatedAt":2}\n')
    expect(out.text).toContain('"id":"a"')
    expect(out.text).toContain('"id":"b"')
    expect(out.skippedIllegal).toBe(0)
    expect(out.clampedFuture).toBe(0)
  })

  it('sanitizeRecordTimestamps clamps far-future and drops negative', () => {
    const now = 1_700_000_000_000
    const clamped = sanitizeRecordTimestamps(
      { id: 'a', updatedAt: now + JSONL_FUTURE_SKEW_MS + 1 },
      now
    )
    expect(clamped).toEqual({
      row: { id: 'a', updatedAt: now },
      clampedFuture: true
    })
    expect(sanitizeRecordTimestamps({ id: 'b', updatedAt: -1 }, now)).toBeNull()
  })

  it('parseJsonlText counts skippedIllegal and clampedFuture', () => {
    const now = 1_700_000_000_000
    const text = [
      '{"id":"ok","updatedAt":1}',
      '{"id":"future","updatedAt":' + (now + JSONL_FUTURE_SKEW_MS + 5) + '}',
      '{"id":"neg","updatedAt":-9}',
      'not-json',
      '{"noId":true,"updatedAt":1}'
    ].join('\n')
    const parsed = parseJsonlText(text, now)
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows.find((r) => r.id === 'future')?.updatedAt).toBe(now)
    expect(parsed.skippedIllegal).toBe(3)
    expect(parsed.clampedFuture).toBe(1)
  })
})

describe('isMonthlyJsonlRawPath', () => {
  it('accepts Memory and Graph collection shards', () => {
    expect(isMonthlyJsonlRawPath('Memory/2026-07.jsonl')).toBe(true)
    expect(isMonthlyJsonlRawPath('Graph/nodes/2026-07.jsonl')).toBe(true)
    expect(isMonthlyJsonlRawPath('Graph/edges/2026-07.jsonl')).toBe(true)
    expect(isMonthlyJsonlRawPath('Graph/extract-state/2026-07.jsonl')).toBe(true)
  })

  it('rejects manifest, nested Memory paths, and other paths', () => {
    expect(isMonthlyJsonlRawPath('Memory/shards.manifest.json')).toBe(false)
    expect(isMonthlyJsonlRawPath('Graph/nodes/shards.manifest.json')).toBe(false)
    expect(isMonthlyJsonlRawPath('Journals/2026-07-01.md')).toBe(false)
    expect(isMonthlyJsonlRawPath('Memory/foo/bar.jsonl')).toBe(false)
    expect(isMonthlyJsonlRawPath('Personal/Memory/foo/bar.jsonl')).toBe(false)
    expect(isMonthlyJsonlRawPath('Personal/Memory/2026-07.jsonl')).toBe(true)
    expect(isMonthlyJsonlRawPath('Personal/Notebooks/nb1/graph/nodes/src_abc.jsonl')).toBe(true)
  })
})

describe('classifyMonthlyJsonlPath', () => {
  it('keeps vault Graph and notebook graph apart', () => {
    expect(classifyMonthlyJsonlPath('Personal/Graph/nodes/2026-07.jsonl')).toEqual({
      kind: 'graph',
      collection: 'nodes',
      shardFile: '2026-07.jsonl',
      shardMonth: '2026-07'
    })
    expect(
      classifyMonthlyJsonlPath('Personal/Notebooks/nb1/graph/nodes/src_abc.jsonl')
    ).toEqual({
      kind: 'notebook-graph',
      notebookId: 'nb1',
      collection: 'nodes',
      shardFile: 'src_abc.jsonl',
      shardMonth: 'src_abc'
    })
  })
})

describe('shouldLineMergeMonthlyJsonlOnConflict', () => {
  it('merges Memory only; overwrites vault Graph and notebook-graph', () => {
    expect(shouldLineMergeMonthlyJsonlOnConflict('Memory/2026-07.jsonl')).toBe(true)
    expect(shouldLineMergeMonthlyJsonlOnConflict('Personal/Memory/2026-07.jsonl')).toBe(true)
    expect(shouldLineMergeMonthlyJsonlOnConflict('Graph/nodes/2026-07.jsonl')).toBe(false)
    expect(shouldLineMergeMonthlyJsonlOnConflict('Graph/edges/2026-07.jsonl')).toBe(false)
    expect(shouldLineMergeMonthlyJsonlOnConflict('Graph/extract-state/2026-07.jsonl')).toBe(false)
    expect(
      shouldLineMergeMonthlyJsonlOnConflict('Personal/Notebooks/nb1/graph/nodes/src_abc.jsonl')
    ).toBe(false)
    expect(
      shouldLineMergeMonthlyJsonlOnConflict('Work/Notebooks/nb3/graph/extract-state/src_def.jsonl')
    ).toBe(false)
    expect(shouldLineMergeMonthlyJsonlOnConflict('Journals/2026-07-01.md')).toBe(false)
  })

  it('sync validator accepts notebook sourceId and leftover calendar months', () => {
    const accept = shardKeyValidatorForJsonlKind('notebook-graph')
    expect(accept('src_abc')).toBe(true)
    expect(accept('2026-08')).toBe(true)
    expect(accept('not a key')).toBe(false)
    expect(shardKeyValidatorForJsonlKind('graph')('2026-08')).toBe(true)
    expect(shardKeyValidatorForJsonlKind('graph')('src_abc')).toBe(false)
  })
})

describe('applyJsonlConflictResolved', () => {
  it('overwrites vault Graph without calling line-merge', async () => {
    const lineMerge = vi.fn(async () => true)
    const overwriteUpload = vi.fn(async () => undefined)
    const overwriteDownload = vi.fn(async () => undefined)
    const outcome = await applyJsonlConflictResolved({
      filePath: 'Personal/Graph/nodes/2026-07.jsonl',
      direction: 'download',
      lineMerge,
      overwriteUpload,
      overwriteDownload
    })
    expect(outcome).toBe('downloaded')
    expect(lineMerge).not.toHaveBeenCalled()
    expect(overwriteDownload).toHaveBeenCalledOnce()
    expect(overwriteUpload).not.toHaveBeenCalled()
  })

  it('line-merges Memory and overwrites notebook-graph', async () => {
    const lineMerge = vi.fn(async () => true)
    const overwriteUpload = vi.fn(async () => undefined)
    const overwriteDownload = vi.fn(async () => undefined)
    await expect(
      applyJsonlConflictResolved({
        filePath: 'Personal/Memory/2026-07.jsonl',
        direction: 'download',
        lineMerge,
        overwriteUpload,
        overwriteDownload
      })
    ).resolves.toBe('merged')
    await expect(
      applyJsonlConflictResolved({
        filePath: 'Personal/Notebooks/nb1/graph/edges/src_abc.jsonl',
        direction: 'upload',
        lineMerge,
        overwriteUpload,
        overwriteDownload
      })
    ).resolves.toBe('uploaded')
    expect(lineMerge).toHaveBeenCalledTimes(1)
    expect(overwriteUpload).toHaveBeenCalledOnce()
    expect(overwriteDownload).not.toHaveBeenCalled()
  })
})
