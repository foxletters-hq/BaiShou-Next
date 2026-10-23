import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import type { EditorContextMenuOpenPayload } from '../../editor-menus/editor-context-menu-open'

const EXCLUDED_CONTEXT_MENU_SELECTOR =
  '.cm-image-container, .cm-table-block, .cm-table-context-menu-layer, .tbl-menu, .cm-tooltip.tbl-menu-tooltip'

export type { EditorContextMenuOpenPayload }

export interface EditorContextMenuExtensionOptions {
  onOpen: (payload: EditorContextMenuOpenPayload) => void
  /** 额外强制只读（例如宿主尚未把 readOnly 写入 EditorState 时） */
  readOnly?: boolean
  docUri?: string
}

function resolveEventTarget(event: MouseEvent): Element | null {
  const rawTarget = event.target
  if (rawTarget instanceof Element) return rawTarget
  if (rawTarget instanceof Node) return rawTarget.parentElement
  return null
}

/**
 * CodeMirror 正文右键桥接：拦截 contextmenu，交给 Host 按 MenuId.EditorContext 解析。
 * 表格/图片等自带菜单区域放行。
 */
export function editorContextMenuExtension(options: EditorContextMenuExtensionOptions): Extension {
  return EditorView.domEventHandlers({
    contextmenu: (event, view) => {
      const target = resolveEventTarget(event)
      if (target?.closest(EXCLUDED_CONTEXT_MENU_SELECTOR)) {
        return false
      }

      event.preventDefault()
      event.stopPropagation()

      const { from, to } = view.state.selection.main
      options.onOpen({
        x: event.clientX,
        y: event.clientY,
        context: {
          view,
          hasSelection: from !== to,
          readOnly: options.readOnly === true || view.state.readOnly,
          docUri: options.docUri
        }
      })
      return true
    }
  })
}
