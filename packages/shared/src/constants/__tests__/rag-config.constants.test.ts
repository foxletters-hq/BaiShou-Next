import { describe, expect, it } from 'vitest'
import {
  RAG_TOP_K_MAX,
  clampRagSimilarityThreshold,
  clampRagTopK
} from '../rag-config.constants'

describe('rag-config.constants', () => {
  it('should allow Top-K up to 200', () => {
    expect(RAG_TOP_K_MAX).toBe(200)
    expect(clampRagTopK(200)).toBe(200)
  })

  it('should clamp Top-K below 1 and above the max', () => {
    expect(clampRagTopK(0)).toBe(1)
    expect(clampRagTopK(500)).toBe(200)
    expect(clampRagTopK('12.6')).toBe(13)
    expect(clampRagTopK(undefined)).toBe(20)
  })

  it('should clamp similarity threshold into 0–1', () => {
    expect(clampRagSimilarityThreshold(-0.2)).toBe(0)
    expect(clampRagSimilarityThreshold(1.4)).toBe(1)
    expect(clampRagSimilarityThreshold('0.55')).toBe(0.55)
    expect(clampRagSimilarityThreshold('nope')).toBe(0.4)
  })
})
