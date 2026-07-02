import { describe, it, expect, afterEach, vi } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { setActiveTableCell } from '../table/tableActiveCell'
import { forceTableRefresh } from '../table/tableEffects'

describe('TableBlockWidget mouse interactions', () => {
  let parent: HTMLElement | null = null

  function activateCell(
    view: ReturnType<typeof createDiaryCodeMirror>,
    rowIndex: number,
    colIndex: number
  ): void {
    view.dispatch({
      effects: [
        setActiveTableCell.of({ tableFrom: 0, rowIndex, colIndex }),
        forceTableRefresh.of(null)
      ]
    })
  }

  afterEach(() => {
    parent?.remove()
    parent = null
    document.querySelectorAll('.cm-table-context-menu-layer').forEach((el) => el.remove())
  })

  it('renders grip icons inside column handles', () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    activateCell(view, 0, 0)
    const handle = parent.querySelector('.cm-table-col-handle') as HTMLButtonElement | null
    expect(handle).toBeTruthy()
    expect(handle!.querySelector('.cm-table-grip-icon')).toBeTruthy()
    expect(handle!.draggable).toBe(true)

    view.destroy()
  })

  it('opens table context menu on handle right click', () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    activateCell(view, 0, 0)
    const handle = parent.querySelector('.cm-table-col-handle') as HTMLButtonElement | null
    handle!.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })
    )

    expect(document.querySelector('.cm-table-context-menu')).toBeTruthy()
    expect(document.querySelector('.cm-table-context-menu')?.textContent).toContain('删除列')

    view.destroy()
  })

  it('runs menu action when clicking a desktop menu item', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const content = '| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |'
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    activateCell(view, 0, 0)
    const handle = parent.querySelector('.cm-table-col-handle') as HTMLButtonElement | null
    handle!.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })
    )

    const deleteBtn = [...document.querySelectorAll('.cm-table-context-menu-item')].find((el) =>
      el.textContent?.includes('删除列')
    ) as HTMLButtonElement | undefined
    expect(deleteBtn).toBeTruthy()
    deleteBtn!.click()

    await vi.waitFor(() => {
      expect(view.state.doc.toString()).not.toMatch(/\| A \|/)
    })
    expect(document.querySelector('.cm-table-context-menu-layer')).toBeFalsy()

    view.destroy()
  })

  it('redirects cursor from blank line after table to following paragraph on desktop', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    const gapFrom = view.state.doc.line(4).from
    view.dispatch({ selection: { anchor: gapFrom } })
    view.focus()
    await new Promise((r) => queueMicrotask(r))

    expect(view.state.selection.main.head).toBeGreaterThan(gapFrom)
    expect(parent.querySelector('.cm-table-block')).toBeTruthy()

    view.destroy()
  })

  it('keeps typed text out of table when inserting at gap line', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    const gapFrom = view.state.doc.line(4).from
    view.dispatch({
      changes: { from: gapFrom, insert: 'Hello' },
      selection: { anchor: gapFrom + 5 }
    })
    await new Promise((r) => queueMicrotask(r))

    expect(view.state.doc.toString()).toContain('Hello')
    expect(view.state.doc.toString()).not.toMatch(/\| Hello/)
    expect(view.state.doc.toString()).toMatch(/\| 1 \| 2 \|\n\nHello/)

    view.destroy()
  })

  it('opens table menu from fixed corner button and deletes after confirmation', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    const corner = parent.querySelector('.cm-table-corner-menu') as HTMLButtonElement | null
    corner!.click()

    const deleteBtn = [...document.querySelectorAll('.cm-table-context-menu-item')].find((el) =>
      el.textContent?.includes('删除表格')
    ) as HTMLButtonElement | undefined
    expect(deleteBtn).toBeTruthy()
    deleteBtn!.click()

    await vi.waitFor(() => {
      expect(confirm).toHaveBeenCalled()
      expect(view.state.doc.toString()).toBe('')
    })

    confirm.mockRestore()
    view.destroy()
  })

  it('shows only active row and column handles while editing a cell', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    view.dispatch({
      effects: [
        setActiveTableCell.of({ tableFrom: 0, rowIndex: 0, colIndex: 1 }),
        forceTableRefresh.of(null)
      ]
    })
    expect(
      parent.querySelector('.cm-table-cell-source[data-row="0"][data-col="1"]')
    ).toBeTruthy()

    const colHandles = [...parent.querySelectorAll('.cm-table-col-handle')]
    const rowHandles = [...parent.querySelectorAll('.cm-table-row-handle')]
    expect(colHandles.map((el) => el.classList.contains('cm-table-handle--active'))).toEqual([
      false,
      true
    ])
    expect(rowHandles.map((el) => el.classList.contains('cm-table-handle--active'))).toEqual([
      false,
      true
    ])

    view.destroy()
  })
})
