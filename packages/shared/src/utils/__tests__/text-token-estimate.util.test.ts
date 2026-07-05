import { describe, expect, it } from 'vitest'
import { estimateTextTokensApprox } from '../text-token-estimate.util'

describe('estimateTextTokensApprox', () => {
  it('returns 0 for empty text', () => {
    expect(estimateTextTokensApprox('')).toBe(0)
  })

  it('uses ceil(length / 3) heuristic', () => {
    expect(estimateTextTokensApprox('abc')).toBe(1)
    expect(estimateTextTokensApprox('abcd')).toBe(2)
    expect(estimateTextTokensApprox('你好世界')).toBe(2)
  })
})
