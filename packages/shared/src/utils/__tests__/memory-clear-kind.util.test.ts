import { describe, expect, it } from 'vitest'
import {
  MEMORY_CLEAR_VECTOR_KINDS,
  parseMemoryClearKinds,
  shouldTombstoneMemoryRecord
} from '../memory-clear-kind.util'

describe('parseMemoryClearKinds', () => {
  it('defaults to all vector kinds when the payload omits kinds', () => {
    expect(parseMemoryClearKinds(undefined)).toEqual([...MEMORY_CLEAR_VECTOR_KINDS])
    expect(parseMemoryClearKinds(undefined)).not.toContain('life_graph')
  })

  it('keeps only known kinds and drops duplicates', () => {
    expect(parseMemoryClearKinds(['diary', 'diary', 'life_graph', 'nope'])).toEqual([
      'diary',
      'life_graph'
    ])
  })
})

describe('shouldTombstoneMemoryRecord', () => {
  it('tombs partner rows only when partner is selected', () => {
    expect(
      shouldTombstoneMemoryRecord(['partner'], { sourceSessionId: 'sess-1' })
    ).toBe(true)
    expect(shouldTombstoneMemoryRecord(['partner'], { sourceSessionId: null })).toBe(false)
  })

  it('tombs manual rows only when manual is selected', () => {
    expect(shouldTombstoneMemoryRecord(['manual'], { sourceSessionId: null })).toBe(true)
    expect(shouldTombstoneMemoryRecord(['manual'], { sourceSessionId: 'sess-1' })).toBe(false)
  })
})
