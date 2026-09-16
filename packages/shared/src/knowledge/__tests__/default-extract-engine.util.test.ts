import { describe, expect, it } from 'vitest'
import { normalizeKnowledgeDefaultExtractEngine } from '../default-extract-engine.util'

describe('normalizeKnowledgeDefaultExtractEngine', () => {
  it('should keep ocr and vision as fill engines', () => {
    expect(normalizeKnowledgeDefaultExtractEngine('ocr')).toBe('ocr')
    expect(normalizeKnowledgeDefaultExtractEngine('vision')).toBe('vision')
  })

  it('should map the old text-layer default and unknown values to ocr', () => {
    expect(normalizeKnowledgeDefaultExtractEngine('simple')).toBe('ocr')
    expect(normalizeKnowledgeDefaultExtractEngine('')).toBe('ocr')
    expect(normalizeKnowledgeDefaultExtractEngine(null)).toBe('ocr')
    expect(normalizeKnowledgeDefaultExtractEngine(undefined)).toBe('ocr')
    expect(normalizeKnowledgeDefaultExtractEngine('other')).toBe('ocr')
  })
})
