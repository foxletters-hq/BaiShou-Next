import { describe, expect, it } from 'vitest'
import {
  resolveDatePickerPlacement,
  DATE_PICKER_DROPDOWN_WIDTH,
  DATE_PICKER_DROPDOWN_HEIGHT,
  DATE_PICKER_GAP,
  DATE_PICKER_MARGIN
} from '../date-picker-placement.util'

describe('date-picker-placement.util', () => {
  const viewport = { width: 1024, height: 768 }

  it('places dropdown below trigger by default with left alignment', () => {
    const trigger = { top: 100, bottom: 132, left: 200, right: 360, width: 160 }
    const pos = resolveDatePickerPlacement(trigger, viewport)

    expect(pos.top).toBe(trigger.bottom + DATE_PICKER_GAP)
    expect(pos.left).toBe(trigger.left)
  })

  it('flips above when insufficient space below', () => {
    const trigger = { top: 600, bottom: 632, left: 200, right: 360, width: 160 }
    const pos = resolveDatePickerPlacement(trigger, viewport)

    expect(pos.top).toBe(trigger.top - DATE_PICKER_DROPDOWN_HEIGHT - DATE_PICKER_GAP)
  })

  it('adjusts left position when overflowing right viewport edge', () => {
    const trigger = { top: 100, bottom: 132, left: 900, right: 1000, width: 100 }
    const pos = resolveDatePickerPlacement(trigger, viewport)

    expect(pos.left + DATE_PICKER_DROPDOWN_WIDTH).toBeLessThanOrEqual(
      viewport.width - DATE_PICKER_MARGIN
    )
  })
})
