import { describe, expect, it } from 'vitest'
import {
  estimateSelectDropdownHeight,
  resolveSelectDropdownBox,
  SELECT_DROPDOWN_MARGIN
} from '../select-dropdown-placement.util'

describe('resolveSelectDropdownBox', () => {
  it('opens below the trigger when there is room', () => {
    const box = resolveSelectDropdownBox(
      { top: 80, bottom: 112, left: 40, width: 160 },
      120,
      { width: 800, height: 600 }
    )
    expect(box.top).toBeGreaterThanOrEqual(112)
    expect(box.left).toBe(40)
    expect(box.width).toBe(160)
  })

  it('opens above the trigger when the bottom space is tight', () => {
    const box = resolveSelectDropdownBox(
      { top: 520, bottom: 552, left: 40, width: 160 },
      180,
      { width: 800, height: 600 }
    )
    expect(box.top + 180).toBeLessThanOrEqual(552)
    expect(box.top).toBeGreaterThanOrEqual(SELECT_DROPDOWN_MARGIN)
  })

  it('keeps the menu inside the viewport', () => {
    const box = resolveSelectDropdownBox(
      { top: 10, bottom: 40, left: 780, width: 160 },
      estimateSelectDropdownHeight(8),
      { width: 800, height: 600 },
      { minWidth: 200 }
    )
    expect(box.left).toBeGreaterThanOrEqual(SELECT_DROPDOWN_MARGIN)
    expect(box.left + box.width).toBeLessThanOrEqual(800 - SELECT_DROPDOWN_MARGIN)
    expect(box.top).toBeGreaterThanOrEqual(SELECT_DROPDOWN_MARGIN)
  })
})
