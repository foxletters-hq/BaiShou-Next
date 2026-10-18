import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'NativeSlider.tsx'),
  'utf8'
)

describe('NativeSlider track gesture', () => {
  it('should use the same custom track on every platform', () => {
    expect(src).toContain('SliderTrack')
    expect(src).not.toContain('CommunitySlider')
    expect(src).not.toContain('useCustomAndroidTrack')
  })

  it('should draw the track and thumb from the shared thinner size tokens', () => {
    expect(src).toContain('NATIVE_SLIDER_TRACK_HEIGHT')
    expect(src).toContain('NATIVE_SLIDER_THUMB_SIZE')
    expect(src).not.toMatch(/const TRACK_HEIGHT = 6/)
    expect(src).not.toMatch(/const THUMB_SIZE = 20/)
  })

  it('should keep dragging from pageX and refuse parent scroll takeover', () => {
    expect(src).toContain('nativeValueFromPageX')
    expect(src).toContain('onPanResponderTerminationRequest: () => false')
    expect(src).toContain("touchAction: 'none'")
    expect(src).not.toContain('event.nativeEvent.locationX -')
  })

  it('should constrain thumb within thumbTrack so endpoints are not clipped', () => {
    expect(src).toContain('thumbTrack')
    expect(src).toContain('left: SLIDER_TRACK_HORIZONTAL_PADDING')
    expect(src).toContain('right: SLIDER_TRACK_HORIZONTAL_PADDING')
  })
})
