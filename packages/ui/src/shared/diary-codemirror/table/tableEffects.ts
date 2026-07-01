import type { EditorView } from '@codemirror/view'
import { StateEffect } from '@codemirror/state'

export const forceTableRefresh = StateEffect.define()

export const pendingTableCellFocus = StateEffect.define<{
  tableFrom: number
  rowIndex: number
  colIndex: number
}>()

export type TableEditorAction =
  | { type: 'addColumn'; tableFrom: number; tableTo: number }
  | { type: 'addRow'; tableFrom: number; tableTo: number }
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
      focusAfter?: { rowIndex: number; colIndex: number }
    }

let tableActionCallback: ((view: EditorView, action: TableEditorAction) => void) | null = null

export function setTableActionCallback(
  callback: ((view: EditorView, action: TableEditorAction) => void) | null
): void {
  tableActionCallback = callback
}

export function invokeTableAction(view: EditorView, action: TableEditorAction): void {
  tableActionCallback?.(view, action)
}
