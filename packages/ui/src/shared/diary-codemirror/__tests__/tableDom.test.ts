import { describe, it, expect, afterEach } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { readTableModelFromBlock, dispatchTableModelFromBlock } from '../table/tableDom'
import { runCellContextMenuAction } from '../table/tableContextMenu'

describe('tableDom', () => {
  let parent: HTMLElement | null = null

  afterEach(() => {
    parent?.remove()
    parent = null
  })

  it('reads cell values from contenteditable sources', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    const block = view.dom.querySelector('.cm-table-block') as HTMLElement
    expect(block).toBeTruthy()

    const firstBodyCell = block.querySelector(
      'tbody td .cm-table-cell-source[data-row="0"][data-col="0"]'
    ) as HTMLElement
    firstBodyCell.textContent = 'updated'
    firstBodyCell.dataset.raw = 'updated'

    const model = readTableModelFromBlock(block)
    expect(model?.rows[0]?.[0]).toBe('updated')

    view.destroy()
  })

  it('commits DOM model back to markdown via posAtDOM range', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    const block = view.dom.querySelector('.cm-table-block') as HTMLElement
    const cell = block.querySelector(
      'tbody td .cm-table-cell-source[data-row="0"][data-col="0"]'
    ) as HTMLElement
    cell.textContent = '9'
    cell.dataset.raw = '9'

    expect(dispatchTableModelFromBlock(view, block)).toBe(true)
    expect(view.state.doc.toString()).toContain('| 9 | 2 |')

    view.destroy()
  })

  it('renders column alignment on touch table cells', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | :---: |\n| 1 | 2 |\n'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    const centered = view.dom.querySelector(
      '.cm-table-grid-cell[data-col="1"]'
    ) as HTMLElement | null
    expect(centered?.getAttribute('align')).toBe('center')

    view.destroy()
  })

  it('preserves separator alignment when committing cell edits', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | :---: |\n| 1 | 2 |\n'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    const block = view.dom.querySelector('.cm-table-block') as HTMLElement
    const cell = block.querySelector(
      'tbody td .cm-table-cell-source[data-row="0"][data-col="0"]'
    ) as HTMLElement
    cell.textContent = '9'
    cell.dataset.raw = '9'

    expect(dispatchTableModelFromBlock(view, block)).toBe(true)
    expect(view.state.doc.toString()).toContain(':---:')

    view.destroy()
  })

  it('applies column alignment from chrome menu action', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    const block = view.dom.querySelector('.cm-table-block') as HTMLElement
    const tableFrom = Number(block.dataset.tableFrom)
    const tableTo = Number(block.dataset.tableTo)

    runCellContextMenuAction(view, tableFrom, tableTo, -1, 1, 'align-center')
    expect(view.state.doc.toString()).toContain(':---:')

    view.destroy()
  })
})
