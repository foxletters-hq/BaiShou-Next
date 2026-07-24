import React from 'react'
import type { EditorContextMenuOpenPayload } from '../../shared/editor-menus'
import { EditorContextMenuHost } from '../ContextMenu/EditorContextMenuHost'

export type { EditorContextMenuOpenPayload as TextContextMenuState }

interface CodeMirrorEditorContextMenuProps {
  menu: EditorContextMenuOpenPayload | null
  onClose: () => void
  /** @deprecated 菜单执行改走 EditorMenuContext.view，保留以兼容旧调用方 */
  viewRef?: React.RefObject<unknown>
}

/** @deprecated 请直接使用 EditorContextMenuHost；此处仅为日记编辑器兼容包装 */
export function CodeMirrorEditorContextMenu({ menu, onClose }: CodeMirrorEditorContextMenuProps) {
  return <EditorContextMenuHost menu={menu} onClose={onClose} variant="cm-context-menu" />
}
