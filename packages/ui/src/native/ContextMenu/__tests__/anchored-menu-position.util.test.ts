import { describe, expect, it } from 'vitest'
import { sharedTokens } from '../../../theme/tokens'
import {
  ANCHORED_MENU_GAP,
  ANCHORED_MENU_MIN_WIDTH,
  computeAnchoredMenuPosition
} from '../anchored-menu-position.util'

const belowTrigger = {
  triggerX: 280,
  triggerY: 120,
  triggerWidth: 30,
  triggerHeight: 30,
  windowWidth: 400,
  windowHeight: 800,
  menuWidth: ANCHORED_MENU_MIN_WIDTH
} as const

describe('computeAnchoredMenuPosition', () => {
  it('should place the menu to the left of the trigger when there is room', () => {
    const next = computeAnchoredMenuPosition({
      ...belowTrigger,
      placement: 'side'
    })
    expect(ANCHORED_MENU_GAP).toBe(sharedTokens.spacing.sm)
    expect(next.left).toBe(280 - ANCHORED_MENU_MIN_WIDTH - ANCHORED_MENU_GAP)
    expect(next.left + ANCHORED_MENU_MIN_WIDTH).toBe(280 - ANCHORED_MENU_GAP)
    expect(next.top).toBe(120)
  })

  it('should place the menu to the right of the trigger when the left side overflows', () => {
    const next = computeAnchoredMenuPosition({
      triggerX: 12,
      triggerY: 80,
      triggerWidth: 30,
      triggerHeight: 30,
      windowWidth: 400,
      windowHeight: 800,
      menuWidth: ANCHORED_MENU_MIN_WIDTH,
      margin: 8,
      placement: 'side'
    })
    expect(next.left).toBe(12 + 30 + ANCHORED_MENU_GAP)
    expect(next.top).toBe(80)
  })

  it('should add triggerYOffset when placing beside the trigger', () => {
    const next = computeAnchoredMenuPosition({
      ...belowTrigger,
      placement: 'side',
      triggerYOffset: 48
    })
    expect(next.top).toBe(120 + 48)
    expect(next.left).toBe(280 - ANCHORED_MENU_MIN_WIDTH - ANCHORED_MENU_GAP)
  })

  it('should clamp a tall side menu to the window instead of covering the trigger', () => {
    const next = computeAnchoredMenuPosition({
      triggerX: 280,
      triggerY: 500,
      triggerWidth: 30,
      triggerHeight: 24,
      windowWidth: 400,
      windowHeight: 560,
      menuWidth: ANCHORED_MENU_MIN_WIDTH,
      menuHeight: 160,
      margin: 8,
      placement: 'side'
    })
    expect(next.left + ANCHORED_MENU_MIN_WIDTH).toBe(280 - ANCHORED_MENU_GAP)
    expect(next.top).toBe(560 - 160 - 8)
    expect(next.top + 160).toBeLessThanOrEqual(560 - 8)
  })

  it('should offset the menu below and inward from the trigger when placement is below', () => {
    const next = computeAnchoredMenuPosition({
      ...belowTrigger,
      placement: 'below'
    })
    expect(next.left).toBe(280 + 30 - ANCHORED_MENU_MIN_WIDTH - ANCHORED_MENU_GAP)
    expect(next.top).toBe(120 + 30 + ANCHORED_MENU_GAP)
  })
})
