import type { EditorState } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'

export type TableChromeSelection = {
  tableFrom: number
  kind: 'col' | 'row'
  index: number
}

export const setTableChromeSelection = StateEffect.define<TableChromeSelection | null>()

export const tableChromeSelectionField = StateField.define<TableChromeSelection | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setTableChromeSelection)) {
        return effect.value
      }
    }
    return value
  }
})

export function readTableChromeSelectionFor(
  state: EditorState,
  tableFrom: number
): TableChromeSelection | null {
  const selected = state.field(tableChromeSelectionField, false)
  if (!selected || selected.tableFrom !== tableFrom) return null
  return selected
}
