import { type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate, Decoration } from '@codemirror/view'
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
import { findTableRangeAt, findTableToByFrom } from '../table/tableBounds'
import {
  resolvePostTableCursor,
  collectPostTableGapRepairsForState,
  isOnStructuralTableGapLine
} from '../table/tablePostGap'
import {
  ensureTableMarkdownTrailingNewline,
  focusTableCellInEditor,
  placeCursorAfterTable
} from '../table/tableFocus'
import { setActiveTableCell } from '../table/tableActiveCell'
import { getCursorPositions, isCursorInRange } from './cursor'
import type { DiaryCmPlatform } from '../types'
import { syntaxTree } from '@codemirror/language'

function applyTableMarkdown(
  view: EditorView,
  tableFrom: number,
  tableTo: number,
  nextMarkdown: string | null,
  focusAfter?: TableCellFocusTarget
): void {
  if (!nextMarkdown) return
  const markdown = ensureTableMarkdownTrailingNewline(view.state.doc, tableTo, nextMarkdown)
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
    changes: { from: tableFrom, to: tableTo, insert: markdown },
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
      const unchanged = !next || next === view.state.doc.sliceString(table.from, table.to)
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
    case 'deleteTable':
      view.dispatch({
        changes: { from: table.from, to: table.to, insert: '' },
        effects: [forceTableRefresh.of(null), setActiveTableCell.of(null)],
        selection: { anchor: table.from },
        annotations: allowTableStructureEdit.of(true)
      })
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

function isTableCellFocused(): boolean {
  const active = document.activeElement
  return active instanceof HTMLTextAreaElement && active.classList.contains('cm-table-cell-input')
}

function resolveTableToFromBlock(block: Element, state: EditorView['state']): number | null {
  const tableFrom = Number((block as HTMLElement).dataset.tableFrom)
  if (Number.isNaN(tableFrom)) return null
  return findTableToByFrom(state, tableFrom)
}

/** 文档以表格结尾（其后仅有空白）时返回该表格结束位置，用于末尾 padding 点击兜底 */
function findTrailingTable(state: EditorView['state']): number | null {
  const tree = syntaxTree(state)
  let lastTableTo: number | null = null
  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      const table = parseTableFromDoc(state.doc, node.from, node.to)
      if (table) lastTableTo = table.to
    }
  })
  if (lastTableTo == null) return null
  const trailing = state.doc.sliceString(lastTableTo)
  if (/\S/.test(trailing)) return null
  return lastTableTo
}

/** 交给控件自身处理的触摸目标（不接管光标） */
const TABLE_TOUCH_PASS_SELECTOR =
  '.cm-table-cell-display, .cm-table-cell-input, .cm-table-handle, .cm-table-add-btn, [role="button"], button, .cm-table-context-menu, .cm-table-context-menu-layer, .cm-table-sheet-layer'

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

/** 隐藏表格源码区视为原子区间，避免光标落入管道符文本 */
export const tableAtomicRanges = EditorView.atomicRanges.of((view) => {
  const marks: { from: number; to: number; value: Decoration }[] = []
  const tree = syntaxTree(view.state)
  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      const table = parseTableFromDoc(view.state.doc, node.from, node.to)
      if (!table) return
      const openingLine = view.state.doc.lineAt(table.from)
      const closingLine = view.state.doc.lineAt(table.to)
      let hiddenLineFrom = openingLine.to + 1
      while (hiddenLineFrom <= closingLine.to) {
        const hiddenLine = view.state.doc.lineAt(hiddenLineFrom)
        marks.push({
          from: hiddenLine.from,
          to: hiddenLine.to,
          value: Decoration.replace({})
        })
        hiddenLineFrom = hiddenLine.to + 1
      }
    }
  })
  return marks.length ? Decoration.set(marks, true) : Decoration.none
})

export function tableTouchPlugin(platform?: DiaryCmPlatform): Extension {
  return ViewPlugin.fromClass(
    class {
      private readonly onTouchEnd = (event: TouchEvent) => this.handleTouchEnd(event)

      constructor(private readonly view: EditorView) {
        if (platform?.interactionMode !== 'touch') return
        view.dom.addEventListener('touchend', this.onTouchEnd, { passive: false })
      }

      destroy() {
        if (platform?.interactionMode !== 'touch') return
        this.view.dom.removeEventListener('touchend', this.onTouchEnd)
      }

      private handleTouchEnd(event: TouchEvent) {
        if (platform?.interactionMode !== 'touch') return
        if (event.changedTouches.length !== 1) return
        if (isTableCellFocused()) return

        const touch = event.changedTouches[0]
        if (!touch) return

        const target = event.target
        if (target instanceof Element) {
          // 单元格 / 把手 / 菜单等交互控件：交给它们自身处理
          if (target.closest(TABLE_TOUCH_PASS_SELECTOR)) return

          // 点击落在表格块 DOM 内的非交互区域（含表格下方衔接条）
          const block = target.closest('.cm-table-block')
          if (block) {
            const tableTo = resolveTableToFromBlock(block, this.view.state)
            if (tableTo != null) this.takeover(tableTo)
            return
          }
        }

        const doc = this.view.state.doc
        const pos = this.safePosAtCoords(touch)

        // 点在内容末尾/末尾空白 padding：若文档以表格结尾则定位到表格后
        if (pos == null || pos >= doc.length) {
          const tableTo = findTrailingTable(this.view.state)
          if (tableTo != null) this.takeover(tableTo)
          return
        }

        // CM 会把光标放进被 widget 替换的隐藏表格源码里
        const range = findTableRangeAt(this.view.state, pos)
        if (range) this.takeover(range.rowTo)
        // 命中普通文本：完全不干预，让 CM 正常定位并弹出键盘
      }

      private safePosAtCoords(touch: Touch): number | null {
        try {
          return this.view.posAtCoords({ x: touch.clientX, y: touch.clientY })
        } catch {
          return null
        }
      }

      private takeover(tableTo: number): void {
        this.view.dispatch({ effects: setActiveTableCell.of(null) })
        placeCursorAfterTable(this.view, tableTo)
      }
    }
  )
}

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
        const fromTableAction = update.transactions.some((tr) =>
          tr.annotation(allowTableStructureEdit)
        )
        if (!fromTableAction) {
          this.schedulePostTableGapRepairs(update.view)
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

    /** 光标误入被 widget 隐藏的表格源码区时，移到表后正文行 */
    private keepSelectionOutsideTables(view: EditorView) {
      if (isTableCellFocused()) return

      const { head } = view.state.selection.main
      const doc = view.state.doc
      const tree = syntaxTree(view.state)
      let redirected = false
      tree.iterate({
        enter(node) {
          if (redirected || node.type.name !== 'Table') return
          const table = parseTableFromDoc(doc, node.from, node.to)
          if (!table) return
          if (isOnStructuralTableGapLine(doc, head, table.to)) {
            redirected = true
            view.dispatch({ effects: setActiveTableCell.of(null) })
            placeCursorAfterTable(view, table.to)
          }
        }
      })
      if (redirected) return

      const range = findTableRangeAt(view.state, head)
      if (!range) return
      if (head > range.rowTo) {
        return
      }
      if (isOnPostTableInputLine(view, head, range.rowTo)) return

      view.dispatch({ effects: setActiveTableCell.of(null) })
      placeCursorAfterTable(view, range.rowTo)
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
