import { describe, expect, it } from 'vitest'
import {
  UI_FONT_SIZE_LEVEL_DEFAULT,
  UI_PAGE_ZOOM_FACTORS,
  normalizeUiFontSizeLevel,
  uiFontSizeLevelFromZoom,
  uiFontSizeScaleFromLevel,
  uiPageZoomFromLevel
} from '../ui-font-size.util'

describe('ui-font-size.util', () => {
  it('defaults invalid values to default level', () => {
    expect(normalizeUiFontSizeLevel(undefined)).toBe(UI_FONT_SIZE_LEVEL_DEFAULT)
    expect(normalizeUiFontSizeLevel('x')).toBe(UI_FONT_SIZE_LEVEL_DEFAULT)
    expect(normalizeUiFontSizeLevel(NaN)).toBe(UI_FONT_SIZE_LEVEL_DEFAULT)
  })

  it('clamps to 0..5', () => {
    expect(normalizeUiFontSizeLevel(-2)).toBe(0)
    expect(normalizeUiFontSizeLevel(9)).toBe(5)
    expect(normalizeUiFontSizeLevel(1.4)).toBe(1)
    expect(normalizeUiFontSizeLevel(1.6)).toBe(2)
  })

  it('maps default level to relative scale 1 and zoom 0.9', () => {
    expect(uiFontSizeScaleFromLevel(UI_FONT_SIZE_LEVEL_DEFAULT)).toBe(1)
    expect(uiPageZoomFromLevel(UI_FONT_SIZE_LEVEL_DEFAULT)).toBe(
      UI_PAGE_ZOOM_FACTORS[UI_FONT_SIZE_LEVEL_DEFAULT]
    )
    expect(uiPageZoomFromLevel(0)).toBe(0.75)
    expect(uiPageZoomFromLevel(5)).toBe(1.35)
  })

  it('maps arbitrary zoom to nearest level', () => {
    expect(uiFontSizeLevelFromZoom(0.9)).toBe(1)
    expect(uiFontSizeLevelFromZoom(0.92)).toBe(1)
    expect(uiFontSizeLevelFromZoom(1.35)).toBe(5)
    expect(uiFontSizeLevelFromZoom(0.5)).toBe(0)
  })
})
