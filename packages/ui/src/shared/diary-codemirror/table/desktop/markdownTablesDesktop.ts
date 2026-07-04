import { Prec, type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { desktopTableInteractionField, setDesktopTableInteraction } from './tableInteractionField'
import { desktopTableTheme } from './desktopTableTheme'
import { forceTableRefresh, pendingTableCellFocus } from '../tableEffects'
import { syncAllDesktopTables } from './sync/desktopTableSync'
import { desktopRootSelectionSyncPlugin } from './sync/desktopRootSelectionSync'
import { isTableEditTransaction } from './tableAnnotation'
import { runDesktopTablePaste, shouldInterceptDesktopTablePaste } from './desktopTablePaste'

function shouldSyncDesktopTable(update: ViewUpdate): boolean {
  return update.transactions.some(
    (tr) =>
      tr.effects.some((e) => e.is(setDesktopTableInteraction) || e.is(forceTableRefresh)) ||
      tr.effects.some((e) => e.is(pendingTableCellFocus)) ||
      (tr.docChanged && !update.transactions.every(isTableEditTransaction))
  )
}

/** 桌面表格扩展包（ckant 对齐，替代旧 desktop Field/sync 栈） */
export function markdownTablesDesktop(): Extension {
  return [
    desktopTableTheme,
    desktopTableInteractionField,
    desktopRootSelectionSyncPlugin(),
    Prec.highest(
      EditorView.domEventHandlers({
        paste(event, view) {
          const text = event.clipboardData?.getData('text/plain') ?? ''
          if (!shouldInterceptDesktopTablePaste(view, text)) return false
          event.preventDefault()
          event.stopPropagation()
          return runDesktopTablePaste(view, text)
        }
      })
    ),
    ViewPlugin.fromClass(
      class {
        update(update: ViewUpdate) {
          if (shouldSyncDesktopTable(update)) {
            syncAllDesktopTables(update.view)
          }
        }
      }
    )
  ]
}
