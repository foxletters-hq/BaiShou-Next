import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { parseTableFromDoc } from '../table/table.model'
import {
  addTableColumnMarkdown,
  addTableRowMarkdown,
  deleteTableColumnMarkdown,
  deleteTableRowMarkdown,
  moveTableColumnMarkdown,
  moveTableRowMarkdown,
  updateTableCellMarkdown
} from '../table/table.ops'
import {
  forceTableRefresh,
  pendingTableCellFocus,
  setTableActionCallback,
  type TableEditorAction
} from '../table/tableEffects'
import { focusTableCellInEditor } from '../table/tableFocus'
import { getCursorPositions, isCursorInRange } from './cursor'

function selectionAfterTable(tableFrom: number, nextMarkdown: string): number {
  return tableFrom + nextMarkdown.length
}

function applyTableMarkdown(
  view: EditorView,
  tableFrom: number,
  tableTo: number,
  nextMarkdown: string | null,
  focusAfter?: { rowIndex: number; colIndex: number }
): void {
  if (!nextMarkdown) return
  const effects = [forceTableRefresh.of(null)]
  if (focusAfter) {
    effects.push(
      pendingTableCellFocus.of({
        tableFrom,
        rowIndex: focusAfter.rowIndex,
        colIndex: focusAfter.colIndex
      })
    )
  }
  view.dispatch({
    changes: { from: tableFrom, to: tableTo, insert: nextMarkdown },
    effects,
    selection: { anchor: selectionAfterTable(tableFrom, nextMarkdown) }
  })
}

function handleTableAction(view: EditorView, action: TableEditorAction): void {
  const table = parseTableFromDoc(view.state.doc, action.tableFrom, action.tableTo)
  if (!table) return

  switch (action.type) {
    case 'updateCell': {
      const next = updateTableCellMarkdown(
        table,
        action.rowIndex,
        action.colIndex,
        action.value
      )
      const unchanged = !next || next === view.state.doc.sliceString(table.from, table.to)
      if (unchanged) {
        if (action.focusAfter) {
          view.dispatch({
            effects: pendingTableCellFocus.of({
              tableFrom: table.from,
              rowIndex: action.focusAfter.rowIndex,
              colIndex: action.focusAfter.colIndex
            })
          })
        }
        return
      }
      applyTableMarkdown(view, table.from, table.to, next, action.focusAfter)
      return
    }
    case 'addColumn':
      applyTableMarkdown(view, table.from, table.to, addTableColumnMarkdown(table))
      return
    case 'addRow':
      applyTableMarkdown(view, table.from, table.to, addTableRowMarkdown(table))
      return
    case 'deleteColumn':
      applyTableMarkdown(
        view,
        table.from,
        table.to,
        deleteTableColumnMarkdown(table, action.colIndex)
      )
      return
    case 'deleteRow':
      applyTableMarkdown(view, table.from, table.to, deleteTableRowMarkdown(table, action.rowIndex))
      return
    case 'moveColumn':
      applyTableMarkdown(
        view,
        table.from,
        table.to,
        moveTableColumnMarkdown(table, action.fromIndex, action.toIndex)
      )
      return
    case 'moveRow':
      applyTableMarkdown(
        view,
        table.from,
        table.to,
        moveTableRowMarkdown(table, action.fromIndex, action.toIndex)
      )
      return
    default:
      return
  }
}

function findTableRangeAt(
  state: EditorView['state'],
  pos: number
): { from: number; nodeTo: number } | null {
  const tree = syntaxTree(state)
  let found: { from: number; nodeTo: number } | null = null
  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      if (pos < node.from || pos >= node.to) return
      const table = parseTableFromDoc(state.doc, node.from, node.to)
      if (table) found = { from: table.from, nodeTo: node.to }
      return false
    }
  })
  return found
}

export const tableEditorPlugin = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      setTableActionCallback((editorView, action) => handleTableAction(editorView, action))
      this.keepSelectionOutsideTables(view)
    }

    update(update: ViewUpdate) {
      if (update.selectionSet) {
        this.keepSelectionOutsideTables(update.view)
      }
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(pendingTableCellFocus)) {
            this.restoreCellFocus(update.view, effect.value)
          }
        }
      }
    }

    destroy() {
      setTableActionCallback(null)
    }

    private restoreCellFocus(
      view: EditorView,
      target: { tableFrom: number; rowIndex: number; colIndex: number }
    ): void {
      const tryFocus = (attempt: number) => {
        if (focusTableCellInEditor(view, target.tableFrom, target.rowIndex, target.colIndex)) {
          return
        }
        if (attempt < 4) {
          requestAnimationFrame(() => tryFocus(attempt + 1))
        }
      }
      requestAnimationFrame(() => tryFocus(0))
    }

    /** 源码区被 widget 替换，避免光标落入隐藏的管道符表格内 */
    private keepSelectionOutsideTables(view: EditorView) {
      const { head } = view.state.selection.main
      const range = findTableRangeAt(view.state, head)
      if (!range) return
      view.dispatch({
        selection: { anchor: range.nodeTo },
        effects: forceTableRefresh.of(null)
      })
    }
  }
)

export function isCursorInsideTable(view: EditorView): boolean {
  const cursors = getCursorPositions(view.state)
  const tree = syntaxTree(view.state)
  let inside = false
  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      if (cursors.some((c) => isCursorInRange(node.from, node.to, [c]))) {
        inside = true
        return false
      }
    }
  })
  return inside
}
