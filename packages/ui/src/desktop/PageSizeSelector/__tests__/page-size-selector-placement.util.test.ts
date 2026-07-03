import { describe, expect, it } from 'vitest'
import {
  estimateDropdownHeight,
  resolveDropdownLeft,
  resolveDropdownPlacement,
  resolveDropdownTop
} from '../page-size-selector-placement.util'

describe('page-size-selector placement', () => {
  it('prefers opening downward when trigger is near the top', () => {
    expect(resolveDropdownPlacement({ top: 72, bottom: 104 }, estimateDropdownHeight(5), 800)).toBe(
      'bottom'
    )
  })

  it('opens upward when there is not enough space below', () => {
    expect(
      resolveDropdownPlacement({ top: 720, bottom: 752 }, estimateDropdownHeight(5), 800)
    ).toBe('top')
  })

  it('clamps dropdown top within viewport', () => {
    const height = estimateDropdownHeight(5)
    const top = resolveDropdownTop({ top: 4, bottom: 36 }, height, 'top', 800)
    expect(top).toBeGreaterThanOrEqual(8)
    expect(top + height).toBeLessThanOrEqual(800 - 8)
  })

  it('centers dropdown horizontally with viewport clamp', () => {
    const left = resolveDropdownLeft({ left: 20, width: 80 }, 160, 320)
    expect(left).toBeGreaterThanOrEqual(8)
    expect(left + 160).toBeLessThanOrEqual(320 - 8)
  })
})
