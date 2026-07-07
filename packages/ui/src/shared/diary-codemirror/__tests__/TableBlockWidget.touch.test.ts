import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { setActiveTableCell } from '../table/tableActiveCell'
import { forceTableRefresh } from '../table/tableEffects'
import { longPressChromeHandle, touchPoint, TABLE_CHROME_LONG_PRESS_MS } from './tableTouchHelpers'
import { resetTableSheetInteractionForTests } from '../table/tableSheetInteraction'

function clearTableSheetDom(): void {
  document
    .querySelectorAll(
      '.cm-table-sheet-layer, .cm-table-context-menu-layer, .cm-table-sheet, .cm-table-sheet-item'
    )
    .forEach((el) => el.remove())
}

describe.sequential('TableBlockWidget touch', () => {
  let parent: HTMLElement | null = null

  beforeEach(() => {
    clearTableSheetDom()
    resetTableSheetInteractionForTests()
  })

  afterEach(() => {
    parent?.remove()
    parent = null
    clearTableSheetDom()
    resetTableSheetInteractionForTests()
    vi.useRealTimers()
  })

  function activateFirstCell(view: ReturnType<typeof createDiaryCodeMirror>): void {
    view.dispatch({
      effects: [
        setActiveTableCell.of({ tableFrom: 0, rowIndex: 0, colIndex: 0 }),
        forceTableRefresh.of(null)
      ]
    })
  }

  function openColMenu(view: ReturnType<typeof createDiaryCodeMirror>): HTMLElement {
    activateFirstCell(view)
    const handle = parent!.querySelector('.cm-table-col-handle') as HTMLElement
    longPressChromeHandle(handle)
    vi.advanceTimersByTime(TABLE_CHROME_LONG_PRESS_MS + 20)
    return handle
  }

  it('opens column menu from column handle after long press', () => {
    vi.useFakeTimers()
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    openColMenu(view)

    expect(document.querySelector('.cm-table-sheet-layer')).toBeTruthy()
    expect(document.querySelector('.cm-table-sheet')?.textContent).toContain('删除列')

    view.destroy()
  })

  it('closes menu when tapping dismiss zone above sheet', () => {
    vi.useFakeTimers()
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    openColMenu(view)

    const menu = document.querySelector('.cm-table-sheet') as HTMLElement | null
    expect(menu).toBeTruthy()
    menu!.dispatchEvent(
      new TouchEvent('touchstart', { bubbles: true, touches: [touchPoint(menu!, 12, 12)] })
    )
    expect(document.querySelector('.cm-table-sheet-layer')).toBeTruthy()

    const dismiss = document.querySelector('.cm-table-sheet-dismiss') as HTMLElement | null
    vi.advanceTimersByTime(400)
    dismiss!.dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [touchPoint(dismiss!, 1, 1)]
      })
    )
    vi.advanceTimersByTime(SHEET_ANIM_MS)

    expect(document.querySelector('.cm-table-sheet-layer')).toBeFalsy()

    view.destroy()
  })

  it('renders outer grid shell border wrapper', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    expect(parent.querySelector('.cm-table-grid-shell')).toBeTruthy()

    view.destroy()
  })

  it('places cursor on paragraph line after table when tapping below block', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    const gapFrom = view.state.doc.line(4).from
    view.dispatch({ selection: { anchor: gapFrom } })
    await new Promise((r) => queueMicrotask(r))

    expect(view.state.selection.main.head).toBeGreaterThan(gapFrom)
    expect(parent.querySelector('.cm-table-block')).toBeTruthy()

    view.destroy()
  })

  function openCornerMenu(view: ReturnType<typeof createDiaryCodeMirror>): void {
    activateFirstCell(view)
    const corner = parent!.querySelector('.cm-table-corner-menu') as HTMLElement
    expect(corner).toBeTruthy()
    longPressChromeHandle(corner)
    vi.advanceTimersByTime(TABLE_CHROME_LONG_PRESS_MS + 20)
    expect(document.querySelector('.cm-table-sheet-layer')).toBeTruthy()
  }

  it('deletes table from corner menu after confirmation', async () => {
    vi.useFakeTimers()
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    openCornerMenu(view)

    const deleteBtn = [...document.querySelectorAll('.cm-table-sheet-item')].find((el) =>
      el.textContent?.includes('删除表格')
    ) as HTMLButtonElement | undefined
    expect(deleteBtn).toBeTruthy()
    deleteBtn!.dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [touchPoint(deleteBtn!, 8, 8)]
      })
    )
    await Promise.resolve()
    await Promise.resolve()

    expect(confirm).toHaveBeenCalled()
    expect(view.state.doc.toString().trim()).toBe('')

    confirm.mockRestore()
    view.destroy()
  })
})

const SHEET_ANIM_MS = 400
