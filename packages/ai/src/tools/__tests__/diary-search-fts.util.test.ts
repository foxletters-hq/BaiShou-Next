import { describe, expect, it } from 'vitest'
import { resolveDiarySearchResultLimit } from '../diary-search-fts.util'

describe('resolveDiarySearchResultLimit', () => {
  it('defaults to 10 when no args or settings', () => {
    expect(resolveDiarySearchResultLimit(undefined, undefined)).toBe(10)
  })

  it('caps model limit by companion customConfigs', () => {
    expect(
      resolveDiarySearchResultLimit(20, {
        customConfigs: { diary_search: { max_results: 8 } }
      })
    ).toBe(8)
  })

  it('uses settings when the model omits limit', () => {
    expect(
      resolveDiarySearchResultLimit(undefined, {
        customConfigs: { diary_search: { max_results: 15 } }
      })
    ).toBe(15)
  })
})
