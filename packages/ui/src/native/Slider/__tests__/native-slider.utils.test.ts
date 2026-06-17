import { describe, expect, it } from 'vitest'
import {
  getAndroidSliderIntegerScale,
  snapSliderValue,
  toNativeSliderProps
} from '../native-slider.utils'

describe('native-slider.utils', () => {
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
})
