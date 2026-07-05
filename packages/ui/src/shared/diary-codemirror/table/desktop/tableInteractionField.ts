import type { EditorState } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'
import type { CellLocation } from './models/cellLocation'
import type { DesktopTableSection } from './models/desktopTableSection'

export type DesktopTableSelectionMode = 'hidden' | 'cell' | 'all'

export type DesktopTableInteraction = {
  tableFrom: number
  activeCell: CellLocation
  anchorCell: CellLocation
  outlinedSection: DesktopTableSection
  mode: DesktopTableSelectionMode
}

export const setDesktopTableInteraction = StateEffect.define<DesktopTableInteraction | null>()

export const desktopTableInteractionField = StateField.define<DesktopTableInteraction | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setDesktopTableInteraction)) {
        return effect.value
      }
    }
    return value
  }
})

export function readDesktopTableInteraction(
  state: EditorState,
  tableFrom: number
): DesktopTableInteraction | null {
  const value = state.field(desktopTableInteractionField, false)
  if (!value || value.tableFrom !== tableFrom) return null
  return value
}

export function isDesktopTableCellMode(state: EditorState, tableFrom: number): boolean {
  const v = readDesktopTableInteraction(state, tableFrom)
  return v?.mode === 'cell'
}
