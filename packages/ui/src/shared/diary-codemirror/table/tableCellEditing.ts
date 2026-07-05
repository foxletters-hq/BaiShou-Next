import type { EditorState } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'

/** 单元格内嵌 CM 编辑态（对齐 ckant selection.isCell()） */
export type TableCellEditing = {
  tableFrom: number
  rowIndex: number
  colIndex: number
}

export const setTableCellEditing = StateEffect.define<TableCellEditing | null>()

export const tableCellEditingField = StateField.define<TableCellEditing | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setTableCellEditing)) {
        return effect.value
      }
    }
    return value
  }
})

export function readTableCellEditingFor(
  state: EditorState,
  tableFrom: number
): TableCellEditing | null {
  const editing = state.field(tableCellEditingField, false)
  if (!editing || editing.tableFrom !== tableFrom) return null
  return editing
}

export function clearTableCellEditingEffects(state: EditorState) {
  return state.field(tableCellEditingField, false) != null ? [setTableCellEditing.of(null)] : []
}
