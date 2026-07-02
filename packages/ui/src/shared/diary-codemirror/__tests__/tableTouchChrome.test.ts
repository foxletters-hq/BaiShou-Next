import { describe, it, expect, afterEach, vi } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { setActiveTableCell } from '../table/tableActiveCell'
import { forceTableRefresh } from '../table/tableEffects'
import {
  longPressChromeHandle,
  finishLongPressChromeHandle,
  TABLE_CHROME_LONG_PRESS_MS
} from './tableTouchHelpers'

describe('table touch chrome (Obsidian layout)', () => {
  let parent: HTMLElement | null = null

  afterEach(() => {
    parent?.remove()
    parent = null
    document.querySelectorAll('.cm-table-sheet-layer, .cm-table-context-menu-layer').forEach((el) =>
      el.remove()
    )
    vi.useRealTimers()
  })

  it('shows embedded handles and add buttons when a cell is active', () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    view.dispatch({
      effects: [
        setActiveTableCell.of({ tableFrom: 0, rowIndex: 0, colIndex: 0 }),
        forceTableRefresh.of(null)
      ]
    })

    expect(parent.querySelector('.cm-table-chrome-top')).toBeTruthy()
    expect(parent.querySelector('.cm-table-col-handle')).toBeTruthy()
    expect(parent.querySelector('.cm-table-row-handle')).toBeTruthy()
    expect(parent.querySelector('.cm-table-add-row')).toBeTruthy()
    expect(parent.querySelector('.cm-table-add-col')).toBeTruthy()
    expect(parent.querySelector('.cm-table-grip-icon')).toBeTruthy()
    expect(parent.querySelector('.cm-table-grid-icon')).toBeTruthy()

    view.destroy()
  })

  it('does not open menu on short tap of column handle', () => {
    vi.useFakeTimers()
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    view.dispatch({
      effects: [
        setActiveTableCell.of({ tableFrom: 0, rowIndex: 0, colIndex: 0 }),
        forceTableRefresh.of(null)
      ]
    })

    const handle = parent.querySelector('.cm-table-col-handle') as HTMLElement
    longPressChromeHandle(handle)
    vi.advanceTimersByTime(TABLE_CHROME_LONG_PRESS_MS - 40)
    finishLongPressChromeHandle()

    expect(document.querySelector('.cm-table-sheet-layer')).toBeFalsy()
    view.destroy()
  })

  it('opens bottom sheet after long-pressing a column handle', () => {
    vi.useFakeTimers()
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    view.dispatch({
      effects: [
        setActiveTableCell.of({ tableFrom: 0, rowIndex: 0, colIndex: 0 }),
        forceTableRefresh.of(null)
      ]
    })

    const handle = parent.querySelector('.cm-table-col-handle') as HTMLElement
    expect(handle).toBeTruthy()
    longPressChromeHandle(handle)
    vi.advanceTimersByTime(TABLE_CHROME_LONG_PRESS_MS + 20)

    expect(document.querySelector('.cm-table-sheet-layer')).toBeTruthy()
    expect(document.querySelector('.cm-table-sheet')?.textContent).toContain('删除列')
    expect(document.querySelector('.cm-table-sheet-backdrop')).toBeFalsy()

    view.destroy()
  })
})
