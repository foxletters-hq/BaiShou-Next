import { Prec, type Extension } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import type { EditorView } from '@codemirror/view'
import {
  normalizeTableCellRange,
  tableCellRangeSelectionField,
  setTableCellRangeSelection
} from './tableRangeSelection'
import {
  clearTableRange,
  copyTableRange,
  pasteTableRange,
  readClipboardTextForTablePaste
} from './tableRangeClipboard'
import { dispatchTableModelFromBlock, isTableCellEditorFocused } from './tableDom'

function withTableRange(
  view: EditorView,
  run: (block: HTMLElement, bounds: ReturnType<typeof normalizeTableCellRange>) => boolean
): boolean {
  if (isTableCellEditorFocused()) return false
  const selected = view.state.field(tableCellRangeSelectionField, false)
  if (!selected) return false
  const block = view.dom.querySelector(
    `.cm-table-block[data-table-from="${selected.tableFrom}"]`
  ) as HTMLElement | null
  if (!block) return false
  return run(block, normalizeTableCellRange(selected))
}

export function tableRangeKeymap(): Extension {
  return Prec.high(
    keymap.of([
      {
        key: 'Mod-c',
        run: (view) =>
          withTableRange(view, (block, bounds) => {
            copyTableRange(block, bounds)
            return true
          })
      },
      {
        key: 'Mod-x',
        run: (view) =>
          withTableRange(view, (block, bounds) => {
            copyTableRange(block, bounds)
            clearTableRange(block, bounds)
            dispatchTableModelFromBlock(view, block)
            return true
          })
      },
      {
        key: 'Mod-v',
        run: (view) => {
          if (isTableCellEditorFocused()) return false
          const selected = view.state.field(tableCellRangeSelectionField, false)
          if (!selected) return false
          const block = view.dom.querySelector(
            `.cm-table-block[data-table-from="${selected.tableFrom}"]`
          ) as HTMLElement | null
          if (!block) return false
          const bounds = normalizeTableCellRange(selected)
          void readClipboardTextForTablePaste().then((text) => {
            if (!text) return
            pasteTableRange(block, bounds, text)
            dispatchTableModelFromBlock(view, block)
          })
          return true
        }
      },
      {
        key: 'Delete',
        run: (view) =>
          withTableRange(view, (block, bounds) => {
            clearTableRange(block, bounds)
            dispatchTableModelFromBlock(view, block)
            view.dispatch({ effects: setTableCellRangeSelection.of(null) })
            return true
          })
      },
      {
        key: 'Backspace',
        run: (view) =>
          withTableRange(view, (block, bounds) => {
            clearTableRange(block, bounds)
            dispatchTableModelFromBlock(view, block)
            view.dispatch({ effects: setTableCellRangeSelection.of(null) })
            return true
          })
      }
    ])
  )
}
