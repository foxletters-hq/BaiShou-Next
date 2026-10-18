import { describe, expect, it } from 'vitest'
import {
  MODAL_BACKDROP_ARM_MS,
  modalCardMaxHeight,
  modalKeyboardPadding
} from '../modal-keyboard.util'

describe('MODAL_BACKDROP_ARM_MS', () => {
  it('should wait for the opening tap to finish before the backdrop can close the modal', () => {
    expect(MODAL_BACKDROP_ARM_MS).toBeGreaterThan(0)
    expect(MODAL_BACKDROP_ARM_MS).toBeLessThan(300)
  })
})

describe('modalKeyboardPadding', () => {
  it('should keep zero padding when the keyboard is hidden', () => {
    expect(modalKeyboardPadding(0, 8)).toBe(0)
    expect(modalKeyboardPadding(-12, 8)).toBe(0)
  })

  it('should add extra spacing above the keyboard when it is visible', () => {
    expect(modalKeyboardPadding(300, 8)).toBe(308)
  })
})

describe('modalCardMaxHeight', () => {
  it('should keep the default 72 percent cap when the keyboard is hidden', () => {
    expect(modalCardMaxHeight(800, 0)).toBe(Math.round(800 * 0.72))
  })

  it('should shrink the card into the space above the keyboard', () => {
    expect(modalCardMaxHeight(800, 308)).toBe(492)
  })

  it('should honor an explicit contentMaxHeight only when it still fits', () => {
    expect(modalCardMaxHeight(800, 0, 400)).toBe(400)
    expect(modalCardMaxHeight(800, 308, 400)).toBe(400)
    expect(modalCardMaxHeight(800, 308, 600)).toBe(492)
  })
})
