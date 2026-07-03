import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  CONTEXT_MENU_GAP,
  CONTEXT_MENU_MARGIN,
  DESKTOP_INPUT_BAR_SELECTOR,
  getComposerBottomInset,
  getDefaultContextMenuBounds,
  resolveContextMenuPosition
} from '../context-menu-placement.util'

describe('context-menu-placement.util', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('reserves space above composer dock', () => {
    const dock = document.createElement('div')
    dock.setAttribute('data-desktop-input-bar', 'true')
    document.body.appendChild(dock)
    dock.getBoundingClientRect = () =>
      ({
        top: 680,
        bottom: 800,
        left: 0,
        right: 1000,
        width: 1000,
        height: 120,
        x: 0,
        y: 680,
        toJSON: () => ({})
      }) as DOMRect

    const inset = getComposerBottomInset(DESKTOP_INPUT_BAR_SELECTOR, 800)
    expect(inset).toBe(800 - 680 + CONTEXT_MENU_GAP)
  })

  it('builds bounds that stop above the composer', () => {
    const bounds = getDefaultContextMenuBounds(1000, 800, 140)

    expect(bounds.bottom).toBe(800 - 140 - CONTEXT_MENU_MARGIN)
    expect(bounds.top).toBe(CONTEXT_MENU_MARGIN)
    expect(bounds.right).toBe(1000 - CONTEXT_MENU_MARGIN)
  })

  it('flips menu above anchor when it would overlap the composer', () => {
    const bounds = getDefaultContextMenuBounds(1000, 800, 140)
    const menuWidth = 140
    const menuHeight = 160

    const position = resolveContextMenuPosition(420, 700, menuWidth, menuHeight, bounds)

    expect(position.y + menuHeight).toBeLessThanOrEqual(bounds.bottom + 0.5)
    expect(position.y).toBe(bounds.bottom - menuHeight)
    expect(position.x).toBe(420)
  })

  it('clamps menu inside horizontal bounds', () => {
    const bounds = getDefaultContextMenuBounds(320, 640, 0)
    const position = resolveContextMenuPosition(300, 120, 180, 120, bounds)

    expect(position.x).toBe(bounds.right - 180)
    expect(position.y).toBe(120)
  })
})
