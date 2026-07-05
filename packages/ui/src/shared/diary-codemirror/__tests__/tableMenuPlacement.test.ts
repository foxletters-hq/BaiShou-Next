import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CONTEXT_MENU_GAP, CONTEXT_MENU_MARGIN } from '../../../desktop/ContextMenu/context-menu-placement.util'
import { portalAndLayoutCkantTableMenu } from '../table/desktop/tableMenuPlacement.util'

describe('tableMenuPlacement.util', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.stubGlobal('innerWidth', 480)
    vi.stubGlobal('innerHeight', 640)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('portals tbl-menu tooltip to body and shifts above diary toolbar', () => {
    const toolbar = document.createElement('div')
    toolbar.setAttribute('data-diary-markdown-toolbar', 'true')
    document.body.appendChild(toolbar)
    toolbar.getBoundingClientRect = () =>
      ({
        top: 560,
        bottom: 612,
        left: 0,
        right: 480,
        width: 480,
        height: 52,
        x: 0,
        y: 560,
        toJSON: () => ({})
      }) as DOMRect

    const editor = document.createElement('div')
    editor.style.overflow = 'hidden'
    document.body.appendChild(editor)

    const tooltip = document.createElement('div')
    tooltip.className = 'cm-tooltip tbl-menu-tooltip'
    tooltip.innerHTML = '<div class="tbl-menu"><div class="tbl-menu-item-text">Delete column</div></div>'
    editor.appendChild(tooltip)

    const menuHeight = 220
    tooltip.getBoundingClientRect = () =>
      ({
        top: 500,
        left: 120,
        right: 280,
        bottom: 500 + menuHeight,
        width: 160,
        height: menuHeight,
        x: 120,
        y: 500,
        toJSON: () => ({})
      }) as DOMRect

    portalAndLayoutCkantTableMenu(tooltip)

    expect(tooltip.parentElement).toBe(document.body)
    expect(tooltip.style.position).toBe('fixed')
    expect(Number.parseFloat(tooltip.style.zIndex)).toBeGreaterThan(400)

    const safeBottom = 640 - (640 - 560 + CONTEXT_MENU_GAP) - CONTEXT_MENU_MARGIN
    expect(Number.parseFloat(tooltip.style.top)).toBeLessThanOrEqual(safeBottom - menuHeight + 0.5)
  })
})
