import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  segmentedEqualItemFrames,
  segmentedEqualThumbRect,
  segmentedThumbRect
} from '../segmented-control.utils'

function nextSegment<T extends string>(
  options: ReadonlyArray<{ value: T }>,
  current: T,
  next: T
): T {
  return options.some((option) => option.value === next) ? next : current
}

describe('SegmentedControl option switch', () => {
  it('should keep the current value when the next option is unknown', () => {
    expect(
      nextSegment([{ value: 'vectors' }, { value: 'graph' }], 'vectors', 'other' as 'graph')
    ).toBe('vectors')
  })

  it('should switch to a listed option', () => {
    expect(nextSegment([{ value: 'vectors' }, { value: 'graph' }], 'vectors', 'graph')).toBe(
      'graph'
    )
  })
})

describe('segmentedThumbRect', () => {
  it('should follow the measured item box instead of splitting the track in half', () => {
    expect(
      segmentedThumbRect(
        [
          { x: 0, width: 48 },
          { x: 48, width: 72 }
        ],
        1
      )
    ).toEqual({ left: 48, width: 72 })
  })

  it('should return null when the active item has not been measured', () => {
    expect(segmentedThumbRect([{ x: 0, width: 40 }], 1)).toBeNull()
    expect(segmentedThumbRect([{ x: 0, width: 0 }], 0)).toBeNull()
  })
})

describe('segmentedEqualThumbRect', () => {
  it('should place the selected block from track width before item onLayout', () => {
    expect(segmentedEqualThumbRect(120, 2, 0)).toEqual({ left: 0, width: 60 })
    expect(segmentedEqualThumbRect(120, 2, 1)).toEqual({ left: 60, width: 60 })
  })

  it('should return null when the track has not been measured', () => {
    expect(segmentedEqualThumbRect(0, 2, 0)).toBeNull()
    expect(segmentedEqualItemFrames(0, 2)).toBeNull()
  })
})

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'SegmentedControl.tsx'),
  'utf8'
)

describe('SegmentedControl layout updates', () => {
  it('should animate the thumb between measured item frames', () => {
    expect(src).toContain('onLayout')
    expect(src).toContain('segmentedThumbRect')
    expect(src).toContain('thumbAnimatedStyle')
    expect(src).toContain('withSpring')
    expect(src).toContain('thumbLeft.value = withSpring(rect.left, SEGMENTED_SPRING_CONFIG)')
    expect(src).toContain('thumbWidth.value = withSpring(rect.width, SEGMENTED_SPRING_CONFIG)')
    expect(src).toContain('Animated.View')
    expect(src).not.toContain('FadeIn')
    expect(src).not.toContain('Animated.Text')
    expect(src).not.toContain('width: `${100 / count}%`')
    expect(src).toContain('backgroundColor: colors.bgSurface')
    expect(src).toContain("overflow: 'visible'")
    expect(src).toContain('thumbReady')
    expect(src).toContain('segmentedEqualItemFrames')
    expect(src).toContain('onInnerLayout')
  })

  it('should expose a compact size with secondary type instead of caption', () => {
    expect(src).toContain("size?: 'small'")
    expect(src).toContain("size === 'small'")
    expect(src).toContain('TRACK_PADDING_SMALL')
    expect(src).toContain('mobileTypography.secondary.fontSize')
    expect(src).toContain('paddingVertical: sharedTokens.spacing.xs')
    expect(src).not.toContain('mobileTypography.caption.fontSize')
    expect(src).not.toContain('paddingVertical: sharedTokens.spacing.xxs')
  })

  it('should keep full width by default and hug content without sticking to the top of a row', () => {
    expect(src).toContain('stretch = true')
    expect(src).toContain('trackHug')
    expect(src).toContain('itemHug')
    expect(src).toMatch(/trackHug:\s*\{[^}]*alignSelf: 'center'/)
    expect(src).not.toMatch(/trackHug:\s*\{[^}]*alignSelf: 'flex-start'/)
  })

  it('should let taps pass through the thumb to the segment underneath', () => {
    expect(src).toContain('pointerEvents="none"')
  })
})
