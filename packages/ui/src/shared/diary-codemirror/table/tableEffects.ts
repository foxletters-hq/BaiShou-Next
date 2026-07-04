import type { EditorView } from '@codemirror/view'
import { Annotation, StateEffect } from '@codemirror/state'

/** 表格 widget / 菜单触发的结构变更；未经此标记的 CM 编辑不得改动表格 Markdown 源码 */
export const allowTableStructureEdit = Annotation.define<boolean>()

export const forceTableRefresh = StateEffect.define()

export const pendingTableCellFocus = StateEffect.define<{
  tableFrom: number
  rowIndex: number
  colIndex: number
  selectionStart?: number
  selectionEnd?: number
  clientX?: number
  clientY?: number
  placeAtEnd?: boolean
  initialInsertText?: string
}>()

export type TableCellFocusTarget = {
  rowIndex: number
  colIndex: number
  selectionStart?: number
  selectionEnd?: number
}

export type TableEditorAction =
  | { type: 'addColumn'; tableFrom: number; tableTo: number; atIndex?: number; focusAfter?: TableCellFocusTarget }
  | { type: 'addRow'; tableFrom: number; tableTo: number; atIndex?: number; templateRow?: string[]; focusAfter?: TableCellFocusTarget }
  | { type: 'deleteTable'; tableFrom: number; tableTo: number }
  | { type: 'deleteColumn'; tableFrom: number; tableTo: number; colIndex: number }
  | { type: 'deleteRow'; tableFrom: number; tableTo: number; rowIndex: number }
  | { type: 'moveColumn'; tableFrom: number; tableTo: number; fromIndex: number; toIndex: number }
  | { type: 'moveRow'; tableFrom: number; tableTo: number; fromIndex: number; toIndex: number }
  | {
      type: 'updateCell'
      tableFrom: number
      tableTo: number
      rowIndex: number
      colIndex: number
      value: string
      focusAfter?: TableCellFocusTarget
    }

let tableActionCallback: ((view: EditorView, action: TableEditorAction) => void) | null = null
let placeCursorAfterTableCallback: ((view: EditorView, tableTo: number) => void) | null = null

export function setTableActionCallback(
  callback: ((view: EditorView, action: TableEditorAction) => void) | null
): void {
  tableActionCallback = callback
}

export function setPlaceCursorAfterTableCallback(
  callback: ((view: EditorView, tableTo: number) => void) | null
): void {
  placeCursorAfterTableCallback = callback
}

export function invokeTableAction(view: EditorView, action: TableEditorAction): void {
  tableActionCallback?.(view, action)
}

export function invokePlaceCursorAfterTable(view: EditorView, tableTo: number): void {
  placeCursorAfterTableCallback?.(view, tableTo)
}
