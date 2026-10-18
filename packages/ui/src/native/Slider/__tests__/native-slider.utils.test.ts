import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  NATIVE_SLIDER_HEIGHT,
  NATIVE_SLIDER_THUMB_SIZE,
  NATIVE_SLIDER_TRACK_HEIGHT,
  SLIDER_TRACK_HORIZONTAL_PADDING,
  getAndroidSliderIntegerScale,
  nativeValueFromPageX,
  snapSliderValue,
  toNativeSliderProps
} from '../native-slider.utils'

describe('native-slider.utils', () => {
  it('should keep the track and thumb thinner than the previous 6 by 20 control', () => {
    expect(NATIVE_SLIDER_TRACK_HEIGHT).toBe(4)
    expect(NATIVE_SLIDER_THUMB_SIZE).toBe(16)
    expect(NATIVE_SLIDER_HEIGHT).toBe(44)
    expect(SLIDER_TRACK_HORIZONTAL_PADDING).toBe(NATIVE_SLIDER_THUMB_SIZE / 2)
  })

  it('should keep the mobile slider sizes written in the UI theme rule', () => {
    const rule = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../../../../docs/1-AI-Code/2-UI-Theme-Rule.md'
      ),
      'utf8'
    )
    expect(rule).toContain('### 3.11 移动端滑动条')
    expect(rule).toContain('NativeSlider')
    expect(rule).toContain(`**${NATIVE_SLIDER_TRACK_HEIGHT}**`)
    expect(rule).toContain(`**${NATIVE_SLIDER_THUMB_SIZE}**`)
    expect(rule).toContain(`**${NATIVE_SLIDER_HEIGHT}**`)
    expect(rule).toContain('NATIVE_SLIDER_TRACK_HEIGHT')
    expect(rule).toContain('NATIVE_SLIDER_THUMB_SIZE')
    expect(rule).toContain('NATIVE_SLIDER_HEIGHT')
  })

  it('snaps fractional values to step precision', () => {
    expect(snapSliderValue(0.405, 0, 1, 0.01)).toBe(0.41)
  })

  it('maps 0.01 logical step to integer native scale on Android', () => {
    expect(getAndroidSliderIntegerScale(0.01)).toBe(100)
    const props = toNativeSliderProps(0.4, 0, 1, 0.01, 100)
    expect(props).toMatchObject({
      value: 40,
      minimumValue: 0,
      maximumValue: 100,
      step: 1
    })
    expect(props.logicalFromNative(41)).toBe(0.41)
  })

  it('keeps integer steps unchanged', () => {
    const props = toNativeSliderProps(12, 1, 20, 1, 1)
    expect(props).toMatchObject({
      value: 12,
      minimumValue: 1,
      maximumValue: 20,
      step: 1
    })
  })

  it('should map a pageX in the middle of the track to the midpoint', () => {
    const trackPageX = 24
    const trackWidth = 240
    const padding = 10
    const pageX = trackPageX + padding + 0.5 * (trackWidth - padding * 2)
    expect(
      nativeValueFromPageX({
        pageX,
        trackPageX,
        trackWidth,
        horizontalPadding: padding,
        minimumValue: 1,
        maximumValue: 61,
        step: 1
      })
    ).toBe(31)
  })

  it('should keep the dragged value when locationX would read 0 after a vertical off-track move', () => {
    const trackPageX = 24
    const trackWidth = 240
    const padding = 10
    const pageX = trackPageX + padding + 0.7 * (trackWidth - padding * 2)
    const fromPageX = nativeValueFromPageX({
      pageX,
      trackPageX,
      trackWidth,
      horizontalPadding: padding,
      minimumValue: 1,
      maximumValue: 61,
      step: 1
    })
    const fromResetLocationX = nativeValueFromPageX({
      pageX: trackPageX,
      trackPageX,
      trackWidth,
      horizontalPadding: padding,
      minimumValue: 1,
      maximumValue: 61,
      step: 1
    })
    expect(fromPageX).toBe(43)
    expect(fromResetLocationX).toBe(1)
    expect(fromPageX).not.toBe(fromResetLocationX)
  })
})
