import { ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { readDesktopTableInteraction, setDesktopTableInteraction } from '../tableInteractionField'
import { DesktopTableSection } from '../models/desktopTableSection'
import { syncDesktopSelectAllOverlay } from '../desktopInteractiveState'
import { findTableNodeBounds } from '../../tableBounds'

/** 根 CM 选区覆盖整表 → all 模式 + SelectAllOverlay（ckant computeSelection） */
export function desktopRootSelectionSyncPlugin(): Extension {
  return ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (update.selectionSet) {
          this.syncSelection(update.view)
        } else if (update.docChanged) {
          this.clearOrphanOverlays(update.view)
        }
      }

      private syncSelection(view: import('@codemirror/view').EditorView): void {
        view.dom.querySelectorAll('.cm-table-block--desktop').forEach((el) => {
          const block = el as HTMLElement
          const tableFrom = Number(block.dataset.tableFrom)
          if (Number.isNaN(tableFrom)) return

          const bounds = findTableNodeBounds(view.state, tableFrom)
          if (!bounds) {
            syncDesktopSelectAllOverlay(block, false)
            this.clearAllMode(view, tableFrom)
            return
          }

          const { from, to } = view.state.selection.main
          const coversTable = from <= bounds.nodeFrom && to >= bounds.nodeTo
          syncDesktopSelectAllOverlay(block, coversTable)

          if (coversTable) {
            const current = readDesktopTableInteraction(view.state, tableFrom)
            if (current?.mode === 'all') return

            const rowEls = block.querySelectorAll('tbody tr')
            const lastDomRow = rowEls.length
            const lastCol = Math.max(
              0,
              block.querySelectorAll('.cm-table-preview thead th').length - 1
            )
            view.dispatch({
              effects: [
                setDesktopTableInteraction.of({
                  tableFrom,
                  activeCell: { row: lastDomRow, col: lastCol },
                  anchorCell: { row: 0, col: 0 },
                  outlinedSection: DesktopTableSection.fromAnchorHead(
                    { row: 0, col: 0 },
                    { row: lastDomRow, col: lastCol }
                  ),
                  mode: 'all'
                })
              ]
            })
            return
          }

          this.clearAllMode(view, tableFrom)
        })
      }

      private clearOrphanOverlays(view: import('@codemirror/view').EditorView): void {
        view.dom.querySelectorAll('.cm-table-block--desktop').forEach((el) => {
          const block = el as HTMLElement
          const tableFrom = Number(block.dataset.tableFrom)
          if (Number.isNaN(tableFrom)) return
          if (findTableNodeBounds(view.state, tableFrom)) return
          syncDesktopSelectAllOverlay(block, false)
          this.clearAllMode(view, tableFrom)
        })
      }

      private clearAllMode(view: import('@codemirror/view').EditorView, tableFrom: number): void {
        const current = readDesktopTableInteraction(view.state, tableFrom)
        if (current?.mode !== 'all') return
        view.dispatch({ effects: [setDesktopTableInteraction.of(null)] })
      }
    }
  )
}
