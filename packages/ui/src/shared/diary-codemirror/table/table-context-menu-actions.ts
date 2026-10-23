import type { EditorView } from '@codemirror/view'
import { invokeTableAction } from './tableEffects'
import { setTableChromeSelection, clearTableChromeSelection } from './tableChromeSelection'
import { readTableModelFromBlock, writeTextToClipboard, writeTextToClipboardSync } from './tableDom'
import { findTableNodeBounds } from './tableBounds'
import { parseTableFromDoc, serializeTable } from './table.model'
import {
  setColumnAlignmentMarkdown,
  sortTableByColumnMarkdown,
  readTableAlignmentsFromDoc
} from './table.ops'
import { allowTableStructureEdit, forceTableRefresh } from './tableEffects'
import type { ColumnAlignment } from './tableGridModel'

export function runChromeMenuAction(
  view: EditorView,
  tableFrom: number,
  tableTo: number,
  handle: HTMLElement,
  actionId: string
): void {
  const colIndex = Number(handle.dataset.colIndex)
  const rowIndex = Number(handle.dataset.rowIndex)
  if (handle.classList.contains('cm-table-col-handle')) {
    runCellContextMenuAction(view, tableFrom, tableTo, -1, colIndex, actionId)
    return
  }
  if (handle.classList.contains('cm-table-row-handle')) {
    runCellContextMenuAction(view, tableFrom, tableTo, rowIndex, 0, actionId)
  }
}

export function runCellContextMenuAction(
  view: EditorView,
  tableFrom: number,
  tableTo: number,
  rowIndex: number,
  colIndex: number,
  actionId: string
): void {
  if (actionId === 'noop') return

  const applyMarkdown = (markdown: string | null) => {
    if (!markdown) return
    const bounds = findTableNodeBounds(view.state, tableFrom)
    const from = bounds?.nodeFrom ?? tableFrom
    const to = bounds?.nodeTo ?? tableTo
    view.dispatch({
      changes: { from, to, insert: markdown },
      annotations: allowTableStructureEdit.of(true),
      effects: forceTableRefresh.of(null)
    })
  }

  if (rowIndex < 0) {
    switch (actionId) {
      case 'sort-asc':
      case 'sort-desc': {
        const table = parseTableFromDoc(view.state.doc, tableFrom, tableTo)
        if (!table) return
        applyMarkdown(
          sortTableByColumnMarkdown(table, view.state.doc, colIndex, actionId === 'sort-asc')
        )
        return
      }
      case 'align-none':
      case 'align-left':
      case 'align-center':
      case 'align-right': {
        const table = parseTableFromDoc(view.state.doc, tableFrom, tableTo)
        if (!table) return
        const alignment: ColumnAlignment =
          actionId === 'align-left'
            ? 'left'
            : actionId === 'align-center'
              ? 'center'
              : actionId === 'align-right'
                ? 'right'
                : 'none'
        applyMarkdown(setColumnAlignmentMarkdown(table, view.state.doc, colIndex, alignment))
        return
      }
      case 'duplicate-col': {
        const table = parseTableFromDoc(view.state.doc, tableFrom, tableTo)
        if (!table) return
        const header = [...table.header.cells]
        const body = table.bodyRows.map((row) => [...row.cells])
        const alignments = readTableAlignmentsFromDoc(table, view.state.doc)
        header.splice(colIndex + 1, 0, header[colIndex] ?? '')
        alignments.splice(colIndex + 1, 0, alignments[colIndex] ?? 'none')
        body.forEach((row) => row.splice(colIndex + 1, 0, row[colIndex] ?? ''))
        applyMarkdown(serializeTable(header, body, alignments, { prettify: true }))
        return
      }
      case 'clear-col': {
        const table = parseTableFromDoc(view.state.doc, tableFrom, tableTo)
        if (!table) return
        const header = [...table.header.cells]
        const body = table.bodyRows.map((row) => [...row.cells])
        const alignments = readTableAlignmentsFromDoc(table, view.state.doc)
        header[colIndex] = ''
        body.forEach((row) => {
          row[colIndex] = ''
        })
        applyMarkdown(serializeTable(header, body, alignments, { prettify: true }))
        return
      }
      case 'insert-col-left':
        invokeTableAction(view, {
          type: 'addColumn',
          tableFrom,
          tableTo,
          atIndex: colIndex,
          focusAfter: { rowIndex: -1, colIndex }
        })
        return
      case 'insert-col-right':
        invokeTableAction(view, {
          type: 'addColumn',
          tableFrom,
          tableTo,
          atIndex: colIndex + 1,
          focusAfter: { rowIndex: -1, colIndex: colIndex + 1 }
        })
        return
      case 'delete':
        invokeTableAction(view, { type: 'deleteColumn', tableFrom, tableTo, colIndex })
        clearTableChromeSelection(view)
        return
      case 'left':
        invokeTableAction(view, {
          type: 'moveColumn',
          tableFrom,
          tableTo,
          fromIndex: colIndex,
          toIndex: colIndex - 1
        })
        if (colIndex > 0) {
          view.dispatch({
            effects: setTableChromeSelection.of({ tableFrom, kind: 'col', index: colIndex - 1 })
          })
        }
        return
      case 'right':
        invokeTableAction(view, {
          type: 'moveColumn',
          tableFrom,
          tableTo,
          fromIndex: colIndex,
          toIndex: colIndex + 1
        })
        view.dispatch({
          effects: setTableChromeSelection.of({ tableFrom, kind: 'col', index: colIndex + 1 })
        })
        return
    }
    return
  }

  switch (actionId) {
    case 'insert-row-above':
      invokeTableAction(view, {
        type: 'addRow',
        tableFrom,
        tableTo,
        atIndex: rowIndex,
        focusAfter: { rowIndex, colIndex }
      })
      return
    case 'insert-row-below':
      invokeTableAction(view, {
        type: 'addRow',
        tableFrom,
        tableTo,
        atIndex: rowIndex + 1,
        focusAfter: { rowIndex: rowIndex + 1, colIndex }
      })
      return
    case 'duplicate-row': {
      const table = parseTableFromDoc(view.state.doc, tableFrom, tableTo)
      if (!table || rowIndex < 0 || rowIndex >= table.bodyRows.length) return
      const cells = [...table.bodyRows[rowIndex]!.cells]
      invokeTableAction(view, {
        type: 'addRow',
        tableFrom,
        tableTo,
        atIndex: rowIndex + 1,
        templateRow: cells,
        focusAfter: { rowIndex: rowIndex + 1, colIndex }
      })
      return
    }
    case 'clear-row': {
      const table = parseTableFromDoc(view.state.doc, tableFrom, tableTo)
      if (!table || rowIndex < 0 || rowIndex >= table.bodyRows.length) return
      const header = [...table.header.cells]
      const body = table.bodyRows.map((row) => [...row.cells])
      body[rowIndex] = Array.from({ length: header.length }, () => '')
      const alignments = readTableAlignmentsFromDoc(table, view.state.doc)
      applyMarkdown(serializeTable(header, body, alignments, { prettify: true }))
      return
    }
    case 'copy-row': {
      const block = view.dom.querySelector(
        `.cm-table-block[data-table-from="${tableFrom}"]`
      ) as HTMLElement | null
      const model = block ? readTableModelFromBlock(block) : null
      if (!model || rowIndex < 0 || rowIndex >= model.rows.length) return
      const cells = [...model.rows[rowIndex]!]
      writeTextToClipboardSync(`| ${cells.join(' | ')} |`)
      invokeTableAction(view, {
        type: 'addRow',
        tableFrom,
        tableTo,
        atIndex: rowIndex + 1,
        templateRow: cells,
        focusAfter: { rowIndex: rowIndex + 1, colIndex }
      })
      view.dispatch({
        effects: setTableChromeSelection.of({ tableFrom, kind: 'row', index: rowIndex + 1 })
      })
      return
    }
    case 'delete':
      invokeTableAction(view, { type: 'deleteRow', tableFrom, tableTo, rowIndex })
      clearTableChromeSelection(view)
      return
    case 'up':
      invokeTableAction(view, {
        type: 'moveRow',
        tableFrom,
        tableTo,
        fromIndex: rowIndex,
        toIndex: rowIndex - 1
      })
      if (rowIndex > 0) {
        view.dispatch({
          effects: setTableChromeSelection.of({ tableFrom, kind: 'row', index: rowIndex - 1 })
        })
      }
      return
    case 'down':
      invokeTableAction(view, {
        type: 'moveRow',
        tableFrom,
        tableTo,
        fromIndex: rowIndex,
        toIndex: rowIndex + 1
      })
      view.dispatch({
        effects: setTableChromeSelection.of({ tableFrom, kind: 'row', index: rowIndex + 1 })
      })
      return
  }
}

export async function copyTableRowFromBlock(
  block: HTMLElement,
  rowIndex: number
): Promise<boolean> {
  const model = readTableModelFromBlock(block)
  if (!model || rowIndex < 0 || rowIndex >= model.rows.length) return false
  const line = `| ${model.rows[rowIndex]!.join(' | ')} |`
  return writeTextToClipboard(line)
}
