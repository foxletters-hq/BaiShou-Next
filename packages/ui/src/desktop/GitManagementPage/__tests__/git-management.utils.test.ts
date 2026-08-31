import { describe, expect, it } from 'vitest'
import { gitHistoryTotalPages } from '../git-management.utils'

describe('gitHistoryTotalPages', () => {
  it('uses the counted total and does not invent an extra page', () => {
    expect(gitHistoryTotalPages(25, 20)).toBe(2)
    expect(gitHistoryTotalPages(40, 20)).toBe(2)
    expect(gitHistoryTotalPages(41, 20)).toBe(3)
    expect(gitHistoryTotalPages(0, 20)).toBe(1)
  })
})
