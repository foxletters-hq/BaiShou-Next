import { describe, expect, it } from 'vitest'
import {
  INPUT_EXPANDED_DEFAULT_HEIGHT,
  INPUT_MAX_HEIGHT_EXPANDED_CAP,
  INPUT_MIN_HEIGHT,
  clampInputFrameHeight,
  resolveComposerHeight,
  resolveExpandedInputMaxHeight
} from '../input-bar-height.util'

describe('clampInputFrameHeight', () => {
  it('should clamp to minimum when content is shorter than one line', () => {
    expect(clampInputFrameHeight(10, 200)).toBe(INPUT_MIN_HEIGHT)
  })

  it('should clamp to maxHeight when content exceeds the cap', () => {
    expect(clampInputFrameHeight(400, 120)).toBe(120)
  })
})

describe('resolveComposerHeight', () => {
  it('should follow content height when collapsed', () => {
    expect(resolveComposerHeight(80, false, 200)).toBe(80)
  })

  it('should lift to default expanded height when expanded and content is short', () => {
    expect(resolveComposerHeight(40, true, 200)).toBe(INPUT_EXPANDED_DEFAULT_HEIGHT)
  })
})

describe('resolveExpandedInputMaxHeight', () => {
  it('should cap at the hard top when the window is tall', () => {
    expect(resolveExpandedInputMaxHeight(2000)).toBe(INPUT_MAX_HEIGHT_EXPANDED_CAP)
  })

  it('should use the screen ratio when the window is short', () => {
    expect(resolveExpandedInputMaxHeight(400)).toBe(Math.round(400 * 0.42))
  })
})
