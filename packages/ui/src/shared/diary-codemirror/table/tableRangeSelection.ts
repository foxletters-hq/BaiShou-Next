import type { EditorState } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export type TableCellRangeSelection = {
  tableFrom: number
  anchorRow: number
  anchorCol: number
  headRow: number
  headCol: number
}

export type NormalizedTableCellRange = {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
}

export const setTableCellRangeSelection = StateEffect.define<TableCellRangeSelection | null>()

export const tableCellRangeSelectionField = StateField.define<TableCellRangeSelection | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setTableCellRangeSelection)) {
        return effect.value
      }
    }
    return value
  }
})

export function readTableCellRangeSelectionFor(
  state: EditorState,
  tableFrom: number
): TableCellRangeSelection | null {
  const selected = state.field(tableCellRangeSelectionField, false)
  if (!selected || selected.tableFrom !== tableFrom) return null
  return selected
}

export function normalizeTableCellRange(
  selection: TableCellRangeSelection
): NormalizedTableCellRange {
  return {
    minRow: Math.min(selection.anchorRow, selection.headRow),
    maxRow: Math.max(selection.anchorRow, selection.headRow),
    minCol: Math.min(selection.anchorCol, selection.headCol),
    maxCol: Math.max(selection.anchorCol, selection.headCol)
  }
}

export function isCellInTableRange(
  rowIndex: number,
  colIndex: number,
  range: NormalizedTableCellRange
): boolean {
  return (
    rowIndex >= range.minRow &&
    rowIndex <= range.maxRow &&
    colIndex >= range.minCol &&
    colIndex <= range.maxCol
  )
}

export function clearTableCellRangeSelection(view: EditorView): void {
  if (!view.state.field(tableCellRangeSelectionField, false)) return
  view.dispatch({ effects: setTableCellRangeSelection.of(null) })
}
