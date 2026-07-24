import type { EditorMenuContext } from './editor-menu-context'

/** 正文右键打开菜单时的锚点与上下文 */
export interface EditorContextMenuOpenPayload {
  x: number
  y: number
  context: EditorMenuContext
}
