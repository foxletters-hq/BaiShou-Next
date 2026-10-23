import { EditorView, ViewPlugin, type ViewUpdate, Decoration } from '@codemirror/view'
import { Transaction } from '@codemirror/state'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { parseTableFromDoc } from '../table/table.model'
import {
  allowTableStructureEdit,
  diaryPostTableGapNormalize,
  forceTableRefresh,
  pendingTableCellFocus,
  setPlaceCursorAfterTableCallback,
  setTableActionCallback
} from '../table/tableEffects'
import { findTableRangeAt, resolveTableSurfaceRange } from '../table/tableBounds'
import { blurTableCellEditor, isTableCellEditorFocused } from '../table/tableDom'
import { activeTableCellField, clearActiveTableCellEffects } from '../table/tableActiveCell'
import {
  collectPostTableGapRepairsForState,
  isOnStructuralTableGapLine,
  resolvePostTableCursor
} from '../table/tablePostGap'
import { focusTableCellInEditor, placeCursorAfterTable } from '../table/tableFocus'
import { desktopTableInteractionField } from '../table/desktop/tableInteractionField'
import { logDiaryBridge } from '../diaryBridgeDebug'
import { logTableDesktop } from '../table/tableDesktopDebug'
import { shouldDeferTableCaretRedirect, findFencedCodeBlockContaining } from './fencedCodeScan'
import { clearTableInteractionEffects, handleTableAction } from './table-editor-actions'
import { isOnPostTableInputLine, tableBoundaryBackspaceKeymap } from './table-editor-boundary'

export { tableBoundaryBackspaceKeymap }
export { isCursorInsideTable } from './table-editor-boundary'

function isTableCellFocused(): boolean {
  return isTableCellEditorFocused()
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
        if (
          isUndoRedo &&
          (update.startState.field(activeTableCellField, false) != null ||
            update.startState.field(desktopTableInteractionField, false))
        ) {
          blurTableCellEditor()
          queueMicrotask(() => {
            update.view.dispatch({
              effects: [
                ...clearTableInteractionEffects(update.view.state),
                forceTableRefresh.of(null)
              ]
            })
          })
        }
        const fromTableAction = update.transactions.some((tr) =>
          tr.annotation(allowTableStructureEdit)
        )
        if (!fromTableAction) {
          this.schedulePostTableGapRepairs(update.view)
          // 外部全量替换后，原 selection 可能落入新表格 markdown 区间
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
        clientX?: number
        clientY?: number
        placeAtEnd?: boolean
        initialInsertText?: string
      }
    ): void {
      const tryFocus = (attempt: number) => {
        if (
          focusTableCellInEditor(view, target.tableFrom, target.rowIndex, target.colIndex, {
            clientX: target.clientX,
            clientY: target.clientY
          })
        ) {
          if (target.initialInsertText) {
            const block = view.dom.querySelector(
              `.cm-table-block[data-table-from="${target.tableFrom}"]`
            ) as HTMLElement | null
            const editorMount = block?.querySelector('.cm-table-cell-editor') as HTMLElement | null
            const nestedView = editorMount ? EditorView.findFromDOM(editorMount) : null
            if (nestedView) {
              const end = nestedView.state.doc.length
              nestedView.dispatch({
                changes: { from: end, insert: target.initialInsertText },
                selection: {
                  anchor: end + target.initialInsertText.length,
                  head: end + target.initialInsertText.length
                }
              })
            }
          }
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
        view.dispatch({
          changes: pending,
          scrollIntoView: false,
          annotations: [allowTableStructureEdit.of(true), diaryPostTableGapNormalize.of(true)]
        })
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
      if (isTableCellFocused()) {
        logTableDesktop('redirect:skip-cell-focused')
        return
      }

      const focusInTableWidget =
        document.activeElement instanceof HTMLElement &&
        document.activeElement.closest('.cm-table-block') != null
      if (focusInTableWidget) {
        logTableDesktop('redirect:skip-focus-in-widget')
        return
      }

      const activeCell = view.state.field(activeTableCellField, false)
      if (activeCell) {
        logTableDesktop('redirect:skip-active-cell', { ...activeCell })
        return
      }

      const desktopInteraction = view.state.field(desktopTableInteractionField, false)
      if (desktopInteraction) {
        logTableDesktop('redirect:skip-desktop-interaction', {
          tableFrom: desktopInteraction.tableFrom
        })
        return
      }

      ensureSyntaxTree(view.state, view.state.doc.length, 200)

      const { head } = view.state.selection.main
      const doc = view.state.doc
      if (shouldDeferTableCaretRedirect(doc, head)) return
      if (findFencedCodeBlockContaining(doc, head)) return
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
        if (shouldDeferTableCaretRedirect(doc, head, range)) return
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
      if (findFencedCodeBlockContaining(doc, head)) return

      logDiaryBridge('tableEditor', 'redirect:inside-table', {
        head,
        tableFrom: range.from,
        tableTo: range.rowTo,
        nodeTo: range.nodeTo,
        docLen: doc.length
      })
      blurTableCellEditor()
      const effects = clearActiveTableCellEffects(view.state)
      if (effects.length) view.dispatch({ effects })
      placeCursorAfterTable(view, range.rowTo)
    }
  }
)
