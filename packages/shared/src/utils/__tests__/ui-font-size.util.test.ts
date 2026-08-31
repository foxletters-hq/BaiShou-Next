import { describe, expect, it } from 'vitest'
import {
  UI_FONT_SIZE_LEVEL_DEFAULT,
  UI_PAGE_ZOOM_FACTORS,
  normalizeUiFontSizeLevel,
  nextUiFontSizeLevel,
  resolvePageZoomShortcut,
  uiFontSizeLevelFromZoom,
  uiFontSizeScaleFromLevel,
  uiPageZoomFromLevel,
  uiPageZoomFromPersistedSettingsJson
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

  it('reads page zoom from zustand persist JSON', () => {
    expect(uiPageZoomFromPersistedSettingsJson(null)).toBeNull()
    expect(uiPageZoomFromPersistedSettingsJson('{')).toBeNull()
    expect(uiPageZoomFromPersistedSettingsJson(JSON.stringify({ state: {} }))).toBeNull()
    expect(
      uiPageZoomFromPersistedSettingsJson(JSON.stringify({ state: { fontSizeLevel: 4 } }))
    ).toBe(1.2)
  })

  it('resolves zoom shortcuts from key and code', () => {
    expect(resolvePageZoomShortcut({ key: '-' })).toBe('out')
    expect(resolvePageZoomShortcut({ key: 'Minus' })).toBe('out')
    expect(resolvePageZoomShortcut({ code: 'NumpadSubtract' })).toBe('out')
    expect(resolvePageZoomShortcut({ key: '=' })).toBe('in')
    expect(resolvePageZoomShortcut({ key: '0' })).toBe('reset')
    expect(resolvePageZoomShortcut({ key: 'a' })).toBeNull()
    expect(nextUiFontSizeLevel(1, 'out')).toBe(0)
    expect(nextUiFontSizeLevel(0, 'out')).toBe(0)
    expect(nextUiFontSizeLevel(1, 'reset')).toBe(UI_FONT_SIZE_LEVEL_DEFAULT)
  })

  it('maps arbitrary zoom to nearest level', () => {
    expect(uiFontSizeLevelFromZoom(0.9)).toBe(1)
    expect(uiFontSizeLevelFromZoom(0.92)).toBe(1)
    expect(uiFontSizeLevelFromZoom(1.35)).toBe(5)
    expect(uiFontSizeLevelFromZoom(0.5)).toBe(0)
  })
})
