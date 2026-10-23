import { describe, expect, it } from 'vitest'
import { hasPendingCountSource } from '../mobile-pending-embed-ready.util'

describe('hasPendingCountSource', () => {
  it('should treat a missing manager as uncountable', () => {
    expect(hasPendingCountSource(null)).toBe(false)
  })

  it('should treat a present manager as countable', () => {
    expect(hasPendingCountSource({ listPendingIndex: async () => [] })).toBe(true)
  })
})
