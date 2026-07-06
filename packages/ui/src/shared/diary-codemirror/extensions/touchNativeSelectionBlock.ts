import { type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

function isEditorTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (!target.closest('.cm-content')) return false
  if (
    target.closest(
      '.cm-table-block, .cm-table-cell-source, .cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn'
    )
  ) {
    return false
  }
  return true
}

/** 禁止 WebView 原生 DOM 选词，改由 CM drawSelection + 自定义长按选词 */
export function touchNativeSelectionBlockPlugin(): Extension {
  return EditorView.domEventHandlers({
    selectstart(event) {
      if (!isEditorTextTarget(event.target)) return false
      event.preventDefault()
      return true
    },
    contextmenu(event) {
      if (!isEditorTextTarget(event.target)) return false
      event.preventDefault()
      return true
    },
    dragstart(event) {
      if (!isEditorTextTarget(event.target)) return false
      event.preventDefault()
      return true
    }
  })
}
