import { describe, expect, it } from 'vitest'
import {
  clearRagDiaryEmbedFailure,
  markRagDiaryEmbedFailure,
  normalizeDiaryEmbedFailureMessage
} from '../rag-embed-failure.util'

describe('rag-embed-failure.util', () => {
  it('stores normalized failure message', () => {
    const next = markRagDiaryEmbedFailure({ ragEnabled: true, ragTopK: 20, ragSimilarityThreshold: 0.4 }, '  API key invalid  ')
    expect(next.lastDiaryEmbedFailureMessage).toBe('API key invalid')
    expect(next.lastDiaryEmbedFailureAt).toBeGreaterThan(0)
  })

  it('truncates very long messages', () => {
    const long = 'x'.repeat(600)
    const normalized = normalizeDiaryEmbedFailureMessage(long)
    expect(normalized?.length).toBe(501)
    expect(normalized?.endsWith('…')).toBe(true)
  })

  it('clears failure metadata', () => {
    const cleared = clearRagDiaryEmbedFailure({
      ragEnabled: true,
      ragTopK: 20,
      ragSimilarityThreshold: 0.4,
      lastDiaryEmbedFailureAt: Date.now(),
      lastDiaryEmbedFailureMessage: 'oops'
    })
    expect(cleared.lastDiaryEmbedFailureAt).toBeUndefined()
    expect(cleared.lastDiaryEmbedFailureMessage).toBeUndefined()
  })
})
