import type { EditorView } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { DesktopTableSection } from '../models/desktopTableSection'
import {
  readDesktopTableInteraction,
  setDesktopTableInteraction,
  type DesktopTableInteraction
} from '../tableInteractionField'
import { domRowToParsedRow } from '../models/cellLocation'
import { applyDesktopCellOutline } from '../desktopOutlinePaint'
import { formatDesktopTableCellDisplay } from '../../tableCellText'
import { commitDesktopTableToDoc } from '../tableDescription'
import {
  findRootEditorViewFromTableBlock,
  blurTableCellEditor,
  isTableCellEditorFocused
} from '../../tableDom'
import { pendingTableCellFocus } from '../../tableEffects'
import { parseTableFromDoc } from '../../table.model'
import { findCurrentTableRange } from '../../tableDom'
import { resolveTableKeyAction, type TableKeyCommand } from '../../tableKeyResolver'
import { invokeTableAction } from '../../tableEffects'
import { findTableToByFrom } from '../../tableBounds'
import { placeCursorAfterTable } from '../../tableFocus'
import { focusNestedEditorAtPoint } from '../cellEditorFocus'
import { matchCellNavigateKey, shouldLeaveCellForNav } from '../desktopCellNavigate'
import { shouldUseTableRangePaste } from '../../tableGridModel'
import { applyDesktopTablePasteToBlock, domSectionToParsedBounds } from '../desktopRangeClipboard'
import { TableCellEditorHost } from '../../TableCellEditorHost'
import { desktopNestedCellEditorTheme } from '../desktopNestedCellEditorTheme'

const cellEditorHosts = new WeakMap<HTMLElement, TableCellEditorHost>()

/** ckant：Enter 走导航；Shift+Enter 保留 defaultKeymap 换行 */
const desktopCellKeyBindings = defaultKeymap.filter((binding) => binding.key !== 'Enter')

export function applyDesktopOutlineHighlight(
  block: HTMLElement,
  section: DesktopTableSection | null
): void {
  block.classList.toggle('cm-table-block--range-selected', section != null)
  applyDesktopCellOutline(block, section)
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

function mountCellEditor(
  view: EditorView,
  block: HTMLElement,
  tableFrom: number,
  domRow: number,
  col: number
): void {
  const existing = cellEditorHosts.get(block)
  if (existing && existing.rowIndex === domRowToParsedRow(domRow) && existing.colIndex === col) {
    return
  }

  teardownCellEditor(block)

  const cell = block.querySelector(
    `.cm-table-grid-cell[data-row="${domRow}"][data-col="${col}"]`
  ) as HTMLElement | null
  if (!cell) return
  const inner = cell.querySelector('.cm-table-cell-inner') as HTMLElement | null
  if (!inner) return
  const viewEl = inner.querySelector('.cm-table-cell-view') as HTMLElement | null
  const source = inner.querySelector('.cm-table-cell-source') as HTMLElement | null
  if (!viewEl || !source) return

  viewEl.classList.add('cm-table-cell-view--hidden')
  let mount = inner.querySelector('.cm-table-cell-editor') as HTMLElement | null
  if (!mount) {
    mount = document.createElement('div')
    mount.className = 'cm-table-cell-editor'
    mount.dataset.row = String(domRow)
    mount.dataset.col = String(col)
    inner.appendChild(mount)
  }

  const parsedRow = domRowToParsedRow(domRow)
  const raw = source.dataset.raw ?? ''

  const host = new TableCellEditorHost({
    parent: mount,
    rowIndex: parsedRow,
    colIndex: col,
    raw,
    rootEditor: view,
    formatDisplay: formatDesktopTableCellDisplay,
    cellKeyBindings: desktopCellKeyBindings,
    extraExtensions: [
      desktopNestedCellEditorTheme,
      Prec.highest(
        keymap.of([
          {
            key: 'Alt-Enter',
            run: (cm) => {
              const head = cm.state.selection.main.head
              cm.dispatch({
                changes: { from: head, insert: '\n' },
                selection: { anchor: head + 1, head: head + 1 }
              })
              requestAnimationFrame(() => cm.focus())
              return true
            }
          },
          {
            key: 'Enter',
            run: (cm) => runDesktopCellKey(view, block, tableFrom, parsedRow, col, 'enter', cm)
          }
        ])
      )
    ],
    onCommit: (newRaw) => {
      source.dataset.raw = newRaw
      viewEl.textContent = formatDesktopTableCellDisplay(newRaw) || ''
    },
    onBlur: () => {
      commitDesktopTableToDoc(view, block)
    },
    onFocus: () => {},
    onKeyDown: (event) => {
      const cm = cellEditorHosts.get(block)?.editorView
      if (!cm) return false
      const command = mapKey(event, cm)
      if (!command) return false
      const range = findCurrentTableRange(view, block)
      if (!range) return false
      const table = parseTableFromDoc(view.state.doc, range.from, range.to)
      if (!table) return false
      const action = resolveTableKeyAction(table, parsedRow, col, command)
      if (!action) return false
      event.preventDefault()
      event.stopPropagation()
      handleCellKey(view, block, tableFrom, parsedRow, col, action)
      return true
    },
    onPaste: (event) => {
      const text = event.clipboardData?.getData('text/plain') ?? ''
      if (!shouldUseTableRangePaste(text)) return false
      event.preventDefault()
      event.stopPropagation()
      const interaction = readDesktopTableInteraction(view.state, tableFrom)
      if (!interaction) return false
      commitDesktopCellEditors(block, view)
      teardownCellEditor(block)
      applyDesktopTablePasteToBlock(
        view,
        block,
        domSectionToParsedBounds(interaction.outlinedSection),
        interaction,
        text
      )
      return true
    }
  })
  cellEditorHosts.set(block, host)
  requestAnimationFrame(() => {
    host.focus(false)
  })
}

function mapKey(event: KeyboardEvent, cm: EditorView): TableKeyCommand | null {
  const command = matchCellNavigateKey(event)
  if (!command) return null
  if (command === 'enter') return null
  if (
    (command === 'arrow-left' ||
      command === 'arrow-right' ||
      command === 'arrow-up' ||
      command === 'arrow-down') &&
    !shouldLeaveCellForNav(cm, command)
  ) {
    return null
  }
  return command
}

function runDesktopCellKey(
  view: EditorView,
  block: HTMLElement,
  tableFrom: number,
  parsedRow: number,
  col: number,
  command: TableKeyCommand,
  cm: EditorView
): boolean {
  if (
    (command === 'arrow-left' ||
      command === 'arrow-right' ||
      command === 'arrow-up' ||
      command === 'arrow-down') &&
    !shouldLeaveCellForNav(cm, command)
  ) {
    return false
  }
  const range = findCurrentTableRange(view, block)
  if (!range) return false
  const table = parseTableFromDoc(view.state.doc, range.from, range.to)
  if (!table) return false
  const action = resolveTableKeyAction(table, parsedRow, col, command)
  if (!action) return false
  handleCellKey(view, block, tableFrom, parsedRow, col, action)
  return true
}

function handleCellKey(
  view: EditorView,
  block: HTMLElement,
  tableFrom: number,
  rowIndex: number,
  colIndex: number,
  action: NonNullable<ReturnType<typeof resolveTableKeyAction>>
): void {
  const range = findCurrentTableRange(view, block)
  if (!range) return
  const table = parseTableFromDoc(view.state.doc, range.from, range.to)
  if (!table) return
  const tableTo = Number(block.dataset.tableTo) || table.to

  switch (action.kind) {
    case 'insert-inline-break': {
      const host = cellEditorHosts.get(block)
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
      requestAnimationFrame(() => cm.focus())
      return
    }
    case 'focus-cell': {
      commitDesktopTableToDoc(view, block)
      teardownCellEditor(block)
      const domRow = action.rowIndex < 0 ? 0 : action.rowIndex + 1
      view.dispatch({
        effects: [
          setDesktopTableInteraction.of({
            tableFrom,
            activeCell: { row: domRow, col: action.colIndex },
            anchorCell: { row: domRow, col: action.colIndex },
            outlinedSection: DesktopTableSection.ofCell({ row: domRow, col: action.colIndex }),
            mode: 'cell'
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
      commitDesktopTableToDoc(view, block)
      teardownCellEditor(block)
      invokeTableAction(view, {
        type: 'addRow',
        tableFrom,
        tableTo,
        atIndex: action.afterRowIndex + 1,
        focusAfter: { rowIndex: action.afterRowIndex + 1, colIndex: 0 }
      })
      return
    }
    case 'insert-row-above': {
      commitDesktopTableToDoc(view, block)
      teardownCellEditor(block)
      invokeTableAction(view, {
        type: 'addRow',
        tableFrom,
        tableTo,
        atIndex: action.atIndex,
        focusAfter: { rowIndex: action.atIndex, colIndex: 0 }
      })
      return
    }
    case 'exit-after': {
      commitDesktopTableToDoc(view, block)
      teardownCellEditor(block)
      blurTableCellEditor()
      view.dispatch({ effects: setDesktopTableInteraction.of(null) })
      placeCursorAfterTable(view, findTableToByFrom(view.state, tableFrom) ?? tableTo)
    }
  }
}

export function syncDesktopTableBlock(view: EditorView, block: HTMLElement): void {
  const tableFrom = Number(block.dataset.tableFrom)
  if (Number.isNaN(tableFrom)) return

  const interaction = readDesktopTableInteraction(view.state, tableFrom)
  if (!interaction) {
    applyDesktopOutlineHighlight(block, null)
    teardownCellEditor(block)
    block.classList.remove('cm-table-block--has-active-cell')
    return
  }

  block.classList.add('cm-table-block--has-active-cell')
  applyDesktopOutlineHighlight(block, interaction.outlinedSection)

  if (interaction.mode === 'cell') {
    const parsedRow = domRowToParsedRow(interaction.activeCell.row)
    const activeCol = interaction.activeCell.col
    block.querySelectorAll('.cm-table-col-handle').forEach((handle) => {
      const handleCol = Number((handle as HTMLElement).dataset.colIndex)
      handle.classList.toggle('cm-table-handle--active', handleCol === activeCol)
      handle.toggleAttribute('data-active', handleCol === activeCol)
    })
    block.querySelectorAll('.cm-table-row-handle').forEach((handle) => {
      const handleRow = Number((handle as HTMLElement).dataset.rowIndex)
      handle.classList.toggle('cm-table-handle--active', handleRow === parsedRow)
      handle.toggleAttribute('data-active', handleRow === parsedRow)
    })
  } else {
    block.querySelectorAll('.cm-tbl-handle').forEach((handle) => {
      handle.removeAttribute('data-active')
    })
  }

  if (interaction.mode === 'cell') {
    mountCellEditor(view, block, tableFrom, interaction.activeCell.row, interaction.activeCell.col)
  } else {
    teardownCellEditor(block)
  }
}

export function syncAllDesktopTables(view: EditorView): void {
  view.dom.querySelectorAll('.cm-table-block[data-interaction-mode="mouse"]').forEach((block) => {
    syncDesktopTableBlock(view, block as HTMLElement)
  })
}

export function destroyDesktopTableSync(block: HTMLElement): void {
  teardownCellEditor(block)
}

export function commitDesktopCellEditors(block: HTMLElement, view: EditorView): void {
  const host = cellEditorHosts.get(block)
  if (host) {
    const raw = host.readRaw()
    const domRow = host.rowIndex < 0 ? 0 : host.rowIndex + 1
    const source = block.querySelector(
      `.cm-table-cell-source[data-row="${domRow}"][data-col="${host.colIndex}"]`
    ) as HTMLElement | null
    if (source) source.dataset.raw = raw
  }
  commitDesktopTableToDoc(view, block)
}

export function focusDesktopCellEditor(
  block: HTMLElement,
  domRow: number,
  col: number,
  options?: { placeAtEnd?: boolean; clientX?: number; clientY?: number }
): boolean {
  const host = cellEditorHosts.get(block)
  const parsedRow = domRowToParsedRow(domRow)
  if (!host || host.rowIndex !== parsedRow || host.colIndex !== col) return false
  const cm = host.editorView
  if (!cm.hasFocus) cm.focus()
  if (options?.clientX != null && options?.clientY != null) {
    return focusNestedEditorAtPoint(cm, options.clientX, options.clientY)
  }
  if (options?.placeAtEnd) {
    const end = cm.state.doc.length
    cm.dispatch({ selection: { anchor: end, head: end } })
  }
  return true
}

export function dispatchDesktopInteraction(
  view: EditorView,
  interaction: DesktopTableInteraction | null
): void {
  view.dispatch({ effects: setDesktopTableInteraction.of(interaction) })
}

export function isDesktopCellEditorFocused(): boolean {
  return isTableCellEditorFocused()
}

export function findDesktopRootView(block: HTMLElement): EditorView | null {
  return findRootEditorViewFromTableBlock(block)
}
