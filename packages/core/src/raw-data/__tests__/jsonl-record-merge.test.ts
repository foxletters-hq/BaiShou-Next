import { describe, it, expect } from 'vitest'
import {
  mergeJsonlRecordSides,
  pickWinner,
  JsonlRecordMergeService,
  parseJsonlText,
  sanitizeRecordTimestamps,
  JSONL_FUTURE_SKEW_MS
} from '../jsonl-record-merge.service'
import { isMonthlyJsonlRawPath } from '../monthly-jsonl-path.util'

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
  })
})
