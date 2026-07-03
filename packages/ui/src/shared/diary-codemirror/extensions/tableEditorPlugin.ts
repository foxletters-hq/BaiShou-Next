import { EditorView, ViewPlugin, type ViewUpdate, Decoration } from '@codemirror/view'
import { EditorSelection, Prec, Transaction } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
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
  allowTableStructureEdit,
  forceTableRefresh,
  pendingTableCellFocus,
  setPlaceCursorAfterTableCallback,
  setTableActionCallback,
  type TableCellFocusTarget,
  type TableEditorAction
} from '../table/tableEffects'
import { findTableNodeBounds, findTableRangeAt, resolveTableSurfaceRange } from '../table/tableBounds'
import { blurTableCellEditor, isTableCellEditorFocused } from '../table/tableDom'
import { activeTableCellField, setActiveTableCell } from '../table/tableActiveCell'
import {
  collectPostTableGapRepairsForState,
  isOnStructuralTableGapLine,
  resolvePostTableCursor
} from '../table/tablePostGap'
import {
  ensureTableMarkdownTrailingNewline,
  focusTableCellInEditor,
  placeCursorAfterTable
} from '../table/tableFocus'
import { setActiveTableCell, clearActiveTableCellEffects } from '../table/tableActiveCell'
import { logDiaryBridge } from '../diaryBridgeDebug'
import { getCursorPositions, isCursorInRange } from './cursor'

function resolveTableReplaceRange(
  state: import('@codemirror/state').EditorState,
  pipeTableFrom: number,
  pipeTableTo: number
): { from: number; to: number } {
  const bounds = findTableNodeBounds(state, pipeTableFrom)
  if (bounds) return { from: bounds.nodeFrom, to: bounds.nodeTo }
  return { from: pipeTableFrom, to: pipeTableTo }
}

function applyTableMarkdown(
  view: EditorView,
  tableFrom: number,
  tableTo: number,
  nextMarkdown: string | null,
  focusAfter?: TableCellFocusTarget
): void {
  if (!nextMarkdown) return
  const range = resolveTableReplaceRange(view.state, tableFrom, tableTo)
  const markdown = ensureTableMarkdownTrailingNewline(view.state.doc, range.to, nextMarkdown)
  const effects = [forceTableRefresh.of(null)]
  if (focusAfter) {
    effects.push(
      setActiveTableCell.of({ tableFrom, rowIndex: focusAfter.rowIndex, colIndex: focusAfter.colIndex }),
      pendingTableCellFocus.of({
        tableFrom,
        rowIndex: focusAfter.rowIndex,
        colIndex: focusAfter.colIndex,
        selectionStart: focusAfter.selectionStart,
        selectionEnd: focusAfter.selectionEnd
      })
    )
  }
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: markdown },
    effects,
    annotations: allowTableStructureEdit.of(true)
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
      const range = resolveTableReplaceRange(view.state, table.from, table.to)
      const unchanged = !next || next === view.state.doc.sliceString(range.from, range.to)
      if (unchanged) {
        if (action.focusAfter) {
          view.dispatch({
            effects: [
              setActiveTableCell.of({
                tableFrom: table.from,
                rowIndex: action.focusAfter.rowIndex,
                colIndex: action.focusAfter.colIndex
              }),
              pendingTableCellFocus.of({
                tableFrom: table.from,
                rowIndex: action.focusAfter.rowIndex,
                colIndex: action.focusAfter.colIndex,
                selectionStart: action.focusAfter.selectionStart,
                selectionEnd: action.focusAfter.selectionEnd
              })
            ]
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
    case 'deleteTable': {
      const range = resolveTableReplaceRange(view.state, table.from, table.to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '' },
        effects: [forceTableRefresh.of(null), setActiveTableCell.of(null)],
        selection: { anchor: range.from },
        annotations: allowTableStructureEdit.of(true)
      })
      return
    }
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

function isTableCellFocused(): boolean {
  return isTableCellEditorFocused()
}

function isOnPostTableInputLine(view: EditorView, head: number, tableRowTo: number): boolean {
  if (head <= tableRowTo) return false
  const doc = view.state.doc
  const { cursor } = resolvePostTableCursor(doc, tableRowTo)
  try {
    return doc.lineAt(head).number === doc.lineAt(cursor).number
  } catch {
    return false
  }
}

/** 表边界 Backspace：先选中整张表，再次删除才移除（避免吞并表后段落） */
function backspaceAtTableBoundary(view: EditorView): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const pos = sel.head
  if (pos === 0) return false

  const tree = syntaxTree(state)
  let tableBefore: SyntaxNode | null = null

  tree.iterate({
    from: Math.max(0, pos - 2),
    to: pos,
    enter(n) {
      if (n.name !== 'Table') return
      if (n.to === pos || n.to + 1 === pos) {
        tableBefore = n.node
      }
    }
  })

  if (!tableBefore) return false

  const range = tableBefore
  view.dispatch({
    selection: EditorSelection.range(range.from, range.to)
  })
  return true
}

/** 整表 replace 后，表格源码区为原子区间（与 widget 表面区间一致） */
export const tableAtomicRanges = EditorView.atomicRanges.of((view) => {
  const marks: { from: number; to: number; value: Decoration }[] = []
  const tree = syntaxTree(view.state)
  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      const surface = resolveTableSurfaceRange(view.state, node.from, node.to)
      if (!surface) return
      marks.push({
        from: surface.replaceFrom,
        to: surface.replaceTo,
        value: Decoration.replace({})
      })
    }
  })
  return marks.length ? Decoration.set(marks, true) : Decoration.none
})

export const tableEditorPlugin = ViewPlugin.fromClass(
  class {
    private pendingSelectionFix = false
    private pendingGapRepair = false

    constructor(view: EditorView) {
      setTableActionCallback((editorView, action) => handleTableAction(editorView, action))
      setPlaceCursorAfterTableCallback((editorView, tableTo) =>
        placeCursorAfterTable(editorView, tableTo)
      )
      this.schedulePostTableGapRepairs(view)
      queueMicrotask(() => this.scheduleKeepSelectionOutsideTables(view))
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        const isUndoRedo = update.transactions.some((tr) => {
          const ev = tr.annotation(Transaction.userEvent)
          return ev === 'undo' || ev === 'redo'
        })
        if (isUndoRedo && update.startState.field(activeTableCellField, false) != null) {
          blurTableCellEditor()
          queueMicrotask(() => {
            update.view.dispatch({
              effects: [setActiveTableCell.of(null), forceTableRefresh.of(null)]
            })
          })
        }
        const fromTableAction = update.transactions.some((tr) =>
          tr.annotation(allowTableStructureEdit)
        )
        if (!fromTableAction) {
          this.schedulePostTableGapRepairs(update.view)
          // 外部全量替换（RN setContent）后，原 selection 可能落入新表格 markdown
          // 区间；docChanged 不一定伴随 selectionSet，需主动检查并重定向出表格
          this.scheduleKeepSelectionOutsideTables(update.view)
        }
      }
      if (update.selectionSet) {
        this.scheduleKeepSelectionOutsideTables(update.view)
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
      setPlaceCursorAfterTableCallback(null)
    }

    private restoreCellFocus(
      view: EditorView,
      target: {
        tableFrom: number
        rowIndex: number
        colIndex: number
        selectionStart?: number
        selectionEnd?: number
      }
    ): void {
      const selection =
        target.selectionStart != null && target.selectionEnd != null
          ? { start: target.selectionStart, end: target.selectionEnd }
          : undefined
      const tryFocus = (attempt: number) => {
        if (
          focusTableCellInEditor(
            view,
            target.tableFrom,
            target.rowIndex,
            target.colIndex,
            selection
          )
        ) {
          return
        }
        if (attempt < 4) {
          requestAnimationFrame(() => tryFocus(attempt + 1))
        }
      }
      requestAnimationFrame(() => tryFocus(0))
    }

    private schedulePostTableGapRepairs(view: EditorView) {
      if (this.pendingGapRepair) return
      this.pendingGapRepair = true
      queueMicrotask(() => {
        this.pendingGapRepair = false
        const pending = collectPostTableGapRepairsForState(view.state)
        if (!pending.length) return
        view.dispatch({ changes: pending, scrollIntoView: false })
      })
    }

    private scheduleKeepSelectionOutsideTables(view: EditorView) {
      if (this.pendingSelectionFix) return
      this.pendingSelectionFix = true
      queueMicrotask(() => {
        this.pendingSelectionFix = false
        this.keepSelectionOutsideTables(view)
      })
    }

    /** 光标误入 Table 节点覆盖的源码区时，移到表后正文 */
    private keepSelectionOutsideTables(view: EditorView) {
      // 单元格 contenteditable 编辑时 CM head 常仍在表格 markdown 区，勿 blur/重定向
      if (isTableCellFocused()) return

      // setContent 全量替换后语法树可能尚未 parse，需同步确保至少扫到文档末尾
      ensureSyntaxTree(view.state, view.state.doc.length, 200)

      const { head } = view.state.selection.main
      const doc = view.state.doc
      let redirected = false

      syntaxTree(view.state).iterate({
        enter(node) {
          if (redirected || node.type.name !== 'Table') return
          const table = parseTableFromDoc(doc, node.from, node.to)
          if (!table) return
          if (isOnStructuralTableGapLine(doc, head, table.to)) {
            const { cursor } = resolvePostTableCursor(doc, table.to)
            if (head === cursor) return
            redirected = true
            logDiaryBridge('tableEditor', 'redirect:gap-line', { head, tableTo: table.to })
            blurTableCellEditor()
            const effects = clearActiveTableCellEffects(view.state)
            if (effects.length) view.dispatch({ effects })
            placeCursorAfterTable(view, table.to)
            return false
          }
        }
      })
      if (redirected) return

      const range = findTableRangeAt(view.state, head)
      if (!range) return

      if (head > range.rowTo && head < range.nodeTo) {
        logDiaryBridge('tableEditor', 'redirect:swallowed-in-node', {
          head,
          tableFrom: range.from,
          rowTo: range.rowTo,
          nodeTo: range.nodeTo
        })
        blurTableCellEditor()
        const effects = clearActiveTableCellEffects(view.state)
        if (effects.length) view.dispatch({ effects })
        placeCursorAfterTable(view, range.rowTo)
        return
      }

      if (head > range.rowTo) return
      if (isOnPostTableInputLine(view, head, range.rowTo)) return

      logDiaryBridge('tableEditor', 'redirect:inside-table', {
        head,
        tableFrom: range.from,
        tableTo: range.rowTo
      })
      blurTableCellEditor()
      const effects = clearActiveTableCellEffects(view.state)
      if (effects.length) view.dispatch({ effects })
      placeCursorAfterTable(view, range.rowTo)
    }
  }
)

export const tableBoundaryBackspaceKeymap = Prec.high(
  keymap.of([{ key: 'Backspace', run: backspaceAtTableBoundary }])
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
