import type { EditorState } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

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

export function clearTableChromeSelection(view: EditorView): void {
  if (!view.state.field(tableChromeSelectionField, false)) return
  view.dispatch({ effects: setTableChromeSelection.of(null) })
}
