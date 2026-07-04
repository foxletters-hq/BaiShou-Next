import type { EditorView } from '@codemirror/view'
import { readActiveTableCellFor, setActiveTableCell } from './tableActiveCell'
import { readTableCellEditingFor, setTableCellEditing } from './tableCellEditing'
import { readTableChromeSelectionFor, setTableChromeSelection } from './tableChromeSelection'
import {
  normalizeTableCellRange,
  readTableCellRangeSelectionFor,
  setTableCellRangeSelection,
  type NormalizedTableCellRange
} from './tableRangeSelection'
import { applyRangeHighlightToBlock } from './tableRangeHighlight'
import { TableCellEditorHost } from './TableCellEditorHost'
import { normalizeTableCellDisplay } from './tableCellText'
import {
  dispatchTableModelFromBlock,
  findCurrentTableRange,
  isTableCellEditorFocused,
  blurTableCellEditor
} from './tableDom'
import { findTableToByFrom } from './tableBounds'
import { parseTableFromDoc } from './table.model'
import { resolveTableKeyAction, type TableKeyCommand } from './tableKeyResolver'
import { invokeTableAction, pendingTableCellFocus } from './tableEffects'
import { placeCursorAfterTable } from './tableFocus'
import { clearTableRange, copyTableRange, pasteTableRange } from './tableRangeClipboard'

const cellEditorHosts = new WeakMap<HTMLElement, TableCellEditorHost>()

export function getTableCellEditorHost(block: HTMLElement): TableCellEditorHost | undefined {
  return cellEditorHosts.get(block)
}

export function commitTableCellEditors(block: HTMLElement, view: EditorView): void {
  const host = cellEditorHosts.get(block)
  if (host) {
    const raw = host.readRaw()
    const source = block.querySelector(
      `.cm-table-cell-source[data-row="${host.rowIndex}"][data-col="${host.colIndex}"]`
    ) as HTMLElement | null
    if (source) source.dataset.raw = raw
  }
  dispatchTableModelFromBlock(view, block)
}

function syncChromeHandles(
  block: HTMLElement,
  activeRow: number | null | undefined,
  activeCol: number | null | undefined
): void {
  block.classList.toggle('cm-table-block--has-active-cell', activeRow != null || activeCol != null)
  block.querySelectorAll('.cm-table-col-handle').forEach((handle) => {
    const handleCol = Number((handle as HTMLElement).dataset.colIndex)
    handle.classList.toggle(
      'cm-table-handle--active',
      activeCol != null && handleCol === activeCol
    )
  })
  block.querySelectorAll('.cm-table-row-handle').forEach((handle) => {
    const handleRow = Number((handle as HTMLElement).dataset.rowIndex)
    handle.classList.toggle(
      'cm-table-handle--active',
      activeRow != null && handleRow === activeRow
    )
  })
}

function syncChromeSelectionClasses(
  block: HTMLElement,
  chrome: ReturnType<typeof readTableChromeSelectionFor>
): void {
  block.classList.remove('cm-table-block--col-selected', 'cm-table-block--row-selected')
  delete block.dataset.selectedCol
  delete block.dataset.selectedRow
  block
    .querySelectorAll('.cm-table-grid-cell--col-selected, .cm-table-grid-cell--row-selected')
    .forEach((el) => {
      el.classList.remove('cm-table-grid-cell--col-selected', 'cm-table-grid-cell--row-selected')
    })
  if (!chrome) return
  if (chrome.kind === 'col') {
    block.dataset.selectedCol = String(chrome.index)
    block.classList.add('cm-table-block--col-selected')
    block
      .querySelectorAll(`.cm-table-grid-cell[data-col="${chrome.index}"]`)
      .forEach((el) => el.classList.add('cm-table-grid-cell--col-selected'))
  } else {
    block.dataset.selectedRow = String(chrome.index)
    block.classList.add('cm-table-block--row-selected')
    block
      .querySelectorAll(`.cm-table-grid-cell[data-row="${chrome.index}"]`)
      .forEach((el) => el.classList.add('cm-table-grid-cell--row-selected'))
  }
}

function teardownCellEditor(block: HTMLElement): void {
  const host = cellEditorHosts.get(block)
  if (host) {
    host.destroy()
    cellEditorHosts.delete(block)
  }
  block.querySelectorAll('.cm-table-cell-editor').forEach((el) => el.remove())
  block.querySelectorAll('.cm-table-cell-view--hidden').forEach((el) => {
    el.classList.remove('cm-table-cell-view--hidden')
  })
}

function ensureEditorMount(inner: HTMLElement, rowIndex: number, colIndex: number): HTMLElement {
  let mount = inner.querySelector('.cm-table-cell-editor') as HTMLElement | null
  if (!mount) {
    mount = document.createElement('div')
    mount.className = 'cm-table-cell-editor'
    mount.dataset.row = String(rowIndex)
    mount.dataset.col = String(colIndex)
    inner.appendChild(mount)
  }
  return mount
}

function mapTableKeyCommand(event: KeyboardEvent): TableKeyCommand | null {
  if (event.key === 'Tab' && event.shiftKey) return 'shift-tab'
  if (event.key === 'Tab') return 'tab'
  if (event.key === 'Enter' && event.shiftKey) return 'shift-enter'
  if (event.key === 'Enter') return 'enter'
  if (event.key === 'Escape') return 'escape'
  return null
}

function handleCellKeyAction(
  view: EditorView,
  block: HTMLElement,
  tableFrom: number,
  rowIndex: number,
  colIndex: number,
  action: NonNullable<ReturnType<typeof resolveTableKeyAction>>
): void {
  const host = cellEditorHosts.get(block)
  const range = findCurrentTableRange(view, block)
  if (!range) return
  const table = parseTableFromDoc(view.state.doc, range.from, range.to)
  if (!table) return
  const tableTo = Number(block.dataset.tableTo) || table.to

  switch (action.kind) {
    case 'insert-inline-break': {
      if (!host) return
      const cm = host.editorView
      const head = cm.state.selection.main.head
      cm.dispatch({
        changes: { from: head, insert: action.insertText },
        selection: {
          anchor: head + action.insertText.length,
          head: head + action.insertText.length
        }
      })
      commitTableCellEditors(block, view)
      return
    }
    case 'focus-cell': {
      commitTableCellEditors(block, view)
      view.dispatch({
        effects: [
          setActiveTableCell.of({
            tableFrom,
            rowIndex: action.rowIndex,
            colIndex: action.colIndex
          }),
          setTableCellEditing.of({
            tableFrom,
            rowIndex: action.rowIndex,
            colIndex: action.colIndex
          }),
          pendingTableCellFocus.of({
            tableFrom,
            rowIndex: action.rowIndex,
            colIndex: action.colIndex
          })
        ]
      })
      return
    }
    case 'insert-row-below': {
      commitTableCellEditors(block, view)
      invokeTableAction(view, {
        type: 'addRow',
        tableFrom,
        tableTo,
        atIndex: action.afterRowIndex + 1,
        focusAfter: { rowIndex: action.afterRowIndex + 1, colIndex: 0 }
      })
      return
    }
    case 'exit-after': {
      commitTableCellEditors(block, view)
      blurTableCellEditor()
      view.dispatch({
        effects: [setActiveTableCell.of(null), setTableCellEditing.of(null)]
      })
      placeCursorAfterTable(view, findTableToByFrom(view.state, tableFrom) ?? tableTo)
      return
    }
  }
}

function mountCellEditor(
  view: EditorView,
  block: HTMLElement,
  tableFrom: number,
  rowIndex: number,
  colIndex: number
): void {
  const existing = cellEditorHosts.get(block)
  if (existing?.rowIndex === rowIndex && existing.colIndex === colIndex) return

  teardownCellEditor(block)

  const cell = block.querySelector(
    `.cm-table-grid-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
  ) as HTMLElement | null
  if (!cell) return
  const inner = cell.querySelector('.cm-table-cell-inner') as HTMLElement | null
  if (!inner) return
  const viewEl = inner.querySelector('.cm-table-cell-view') as HTMLElement | null
  const source = inner.querySelector('.cm-table-cell-source') as HTMLElement | null
  if (!viewEl || !source) return

  viewEl.classList.add('cm-table-cell-view--hidden')
  const mount = ensureEditorMount(inner, rowIndex, colIndex)
  const raw = source.dataset.raw ?? ''

  const host = new TableCellEditorHost({
    parent: mount,
    rowIndex,
    colIndex,
    raw,
    rootEditor: view,
    onCommit: (newRaw) => {
      source.dataset.raw = newRaw
      viewEl.textContent = normalizeTableCellDisplay(newRaw) || ''
      dispatchTableModelFromBlock(view, block)
    },
    onFocus: () => {
      const effects = [
        setActiveTableCell.of({ tableFrom, rowIndex, colIndex }),
        setTableCellRangeSelection.of(null)
      ]
      if (rowIndex >= 0) {
        effects.push(
          setTableChromeSelection.of({ tableFrom, kind: 'row', index: rowIndex })
        )
      } else {
        effects.push(
          setTableChromeSelection.of({ tableFrom, kind: 'col', index: colIndex })
        )
      }
      view.dispatch({ effects })
    },
    onKeyDown: (event) => {
      const command = mapTableKeyCommand(event)
      if (!command) return
      const cellRange = findCurrentTableRange(view, block)
      if (!cellRange) return
      const table = parseTableFromDoc(view.state.doc, cellRange.from, cellRange.to)
      if (!table) return
      const action = resolveTableKeyAction(table, rowIndex, colIndex, command)
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      handleCellKeyAction(view, block, tableFrom, rowIndex, colIndex, action)
    },
    onPaste: (event) => {
      const selected = readTableCellRangeSelectionFor(view.state, tableFrom)
      if (!selected) return
      event.preventDefault()
      const text = event.clipboardData?.getData('text/plain')
      if (!text) return
      pasteTableRange(block, normalizeTableCellRange(selected), text)
      dispatchTableModelFromBlock(view, block)
    }
  })
  cellEditorHosts.set(block, host)
  requestAnimationFrame(() => {
    if (document.activeElement?.closest('.cm-table-block') === block || !document.hasFocus()) {
      host.focus(false)
    }
  })
}

export function focusNestedTableCellEditor(
  block: HTMLElement,
  rowIndex: number,
  colIndex: number,
  options?: { clientX?: number; clientY?: number; placeAtEnd?: boolean }
): boolean {
  const host = cellEditorHosts.get(block)
  if (!host || host.rowIndex !== rowIndex || host.colIndex !== colIndex) return false
  const cm = host.editorView
  if (!cm.hasFocus) cm.focus()

  if (options?.placeAtEnd) {
    const end = cm.state.doc.length
    cm.dispatch({ selection: { anchor: end, head: end } })
    return true
  }

  if (options?.clientX != null && options?.clientY != null) {
    const content = cm.dom.querySelector('.cm-content') as HTMLElement | null
    const doc = content?.ownerDocument
    if (content && doc) {
      try {
        if (typeof doc.caretPositionFromPoint === 'function') {
          const pos = doc.caretPositionFromPoint(options.clientX, options.clientY)
          if (pos?.offsetNode && content.contains(pos.offsetNode)) {
            const offset = offsetInCmContent(content, pos.offsetNode, pos.offset)
            if (offset != null) {
              cm.dispatch({ selection: { anchor: offset, head: offset } })
              return true
            }
          }
        }
      } catch {
        // fall through
      }
    }
  }
  return true
}

function offsetInCmContent(content: HTMLElement, node: Node, offset: number): number | null {
  const walker = content.ownerDocument.createTreeWalker(content, NodeFilter.SHOW_TEXT)
  let total = 0
  while (walker.nextNode()) {
    const text = walker.currentNode
    if (text === node) return total + offset
    total += (text.textContent ?? '').length
  }
  return null
}

export function syncTableBlockFromState(view: EditorView, block: HTMLElement): void {
  const tableFrom = Number(block.dataset.tableFrom)
  if (Number.isNaN(tableFrom)) return

  const activeCell = readActiveTableCellFor(view.state, tableFrom)
  const cellEditing = readTableCellEditingFor(view.state, tableFrom)
  const rangeSelection = readTableCellRangeSelectionFor(view.state, tableFrom)
  const chromeSelection = readTableChromeSelectionFor(view.state, tableFrom)

  const activeRow =
    chromeSelection?.kind === 'row' ? chromeSelection.index : activeCell?.rowIndex
  const activeCol =
    chromeSelection?.kind === 'col' ? chromeSelection.index : activeCell?.colIndex

  syncChromeHandles(block, activeRow, activeCol)
  syncChromeSelectionClasses(block, chromeSelection)

  if (cellEditing && block.dataset.interactionMode !== 'touch') {
    mountCellEditor(view, block, tableFrom, cellEditing.rowIndex, cellEditing.colIndex)
    return
  }

  if (rangeSelection) {
    teardownCellEditor(block)
    applyRangeHighlightToBlock(block, normalizeTableCellRange(rangeSelection))
    return
  }

  applyRangeHighlightToBlock(block, null)
  teardownCellEditor(block)
}

export function syncAllTableBlocks(view: EditorView): void {
  view.dom.querySelectorAll('.cm-table-block').forEach((block) => {
    syncTableBlockFromState(view, block as HTMLElement)
  })
}

export function destroyTableBlockSync(block: HTMLElement): void {
  teardownCellEditor(block)
}

export function handleTableRangeClipboard(
  view: EditorView,
  block: HTMLElement,
  bounds: NormalizedTableCellRange,
  action: 'copy' | 'cut' | 'paste',
  clipboardText?: string
): void {
  if (action === 'copy') {
    copyTableRange(block, bounds)
    return
  }
  if (action === 'cut') {
    copyTableRange(block, bounds)
    clearTableRange(block, bounds)
    dispatchTableModelFromBlock(view, block)
    return
  }
  if (action === 'paste' && clipboardText) {
    pasteTableRange(block, bounds, clipboardText)
    dispatchTableModelFromBlock(view, block)
  }
}

export function isNestedCellEditorActive(
  view: EditorView,
  tableFrom: number,
  row: number,
  col: number
): boolean {
  if (!isTableCellEditorFocused()) return false
  const editing = readTableCellEditingFor(view.state, tableFrom)
  return editing?.rowIndex === row && editing?.colIndex === col
}
