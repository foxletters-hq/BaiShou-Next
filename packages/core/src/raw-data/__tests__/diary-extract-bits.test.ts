import { describe, expect, it } from 'vitest'
import { resolveDiaryExtractBits } from '../diary-extract-bits'

describe('resolveDiaryExtractBits', () => {
  it('never-extracted journal needs extract', () => {
    expect(resolveDiaryExtractBits({ contentHash: 'h1', extractedHash: null })).toEqual({
      exists: true,
      extracted: false,
      needsReextract: true
    })
  })

  it('matching hash stays extracted', () => {
    expect(resolveDiaryExtractBits({ contentHash: 'h1', extractedHash: 'h1' })).toEqual({
      exists: true,
      extracted: true,
      needsReextract: false
    })
  })

  it('body change needs re-extract', () => {
    expect(resolveDiaryExtractBits({ contentHash: 'h2', extractedHash: 'h1' })).toEqual({
      exists: true,
      extracted: true,
      needsReextract: true
    })
  })

  it('missing journal is not a re-extract bit', () => {
    expect(resolveDiaryExtractBits({ contentHash: '', extractedHash: 'h1' })).toEqual({
      exists: false,
      extracted: true,
      needsReextract: false
    })
  })
})
