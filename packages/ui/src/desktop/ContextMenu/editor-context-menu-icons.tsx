import React from 'react'
import {
  ClipboardPaste,
  Copy,
  Scissors,
  SquareDashedMousePointer,
  Undo2
} from 'lucide-react'
import { BuiltinEditorCommandId } from '../../shared/editor-menus'

const ICON_SIZE = 15

/** 内置编辑命令 iconId / commandId → Lucide 图标（Obsidian 式左图标） */
export function resolveEditorContextMenuIcon(
  iconId: string | undefined,
  commandId: string
): React.ReactNode {
  const key = iconId || commandId
  switch (key) {
    case 'cut':
    case BuiltinEditorCommandId.Cut:
      return <Scissors size={ICON_SIZE} aria-hidden />
    case 'copy':
    case BuiltinEditorCommandId.Copy:
      return <Copy size={ICON_SIZE} aria-hidden />
    case 'paste':
    case BuiltinEditorCommandId.Paste:
      return <ClipboardPaste size={ICON_SIZE} aria-hidden />
    case 'undo':
    case BuiltinEditorCommandId.Undo:
      return <Undo2 size={ICON_SIZE} aria-hidden />
    case 'selectAll':
    case BuiltinEditorCommandId.SelectAll:
      return <SquareDashedMousePointer size={ICON_SIZE} aria-hidden />
    default:
      return null
  }
}
