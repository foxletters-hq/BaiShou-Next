import type { EditorState } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'

export type ActiveTableCell = {
  tableFrom: number
  rowIndex: number
  colIndex: number
}

export const setActiveTableCell = StateEffect.define<ActiveTableCell | null>()

export const activeTableCellField = StateField.define<ActiveTableCell | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setActiveTableCell)) {
        return effect.value
      }
    }
    return value
  }
})

export function readActiveTableCellFor(
  state: EditorState,
  tableFrom: number
): ActiveTableCell | null {
  const active = state.field(activeTableCellField, false)
  if (!active || active.tableFrom !== tableFrom) return null
  return active
}

/** 仅当确有激活单元格时才附带清除 effect，避免无意义触发整表 widget 重建 */
export function clearActiveTableCellEffects(state: EditorState) {
  return state.field(activeTableCellField, false) != null
    ? [setActiveTableCell.of(null)]
    : []
}
