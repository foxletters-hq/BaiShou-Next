import type { EditorView } from '@codemirror/view'
import type { TableKeyCommand } from '../tableKeyResolver'

export type CellEdgePosition = {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

/** 嵌套 CM 光标是否贴边（ckant NavigateActions position） */
export function readCellEdgePosition(cm: EditorView): CellEdgePosition {
  const sel = cm.state.selection.main
  const head = sel.head
  const line = cm.state.doc.lineAt(head)
  const lineStart = line.from
  const lineEnd = line.to
  return {
    top: head <= lineStart,
    bottom: head >= lineEnd,
    left: head === 0,
    right: head === cm.state.doc.length
  }
}

export function matchCellNavigateKey(event: KeyboardEvent): TableKeyCommand | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null
  if (event.shiftKey && event.key === 'Tab') return 'shift-tab'
  if (event.shiftKey && event.key === 'Enter') return null
  if (!event.shiftKey && event.key === 'Tab') return 'tab'
  if (!event.shiftKey && event.key === 'Enter') return 'enter'
  if (event.key === 'Escape') return 'escape'
  if (!event.shiftKey && event.key === 'ArrowLeft') return 'arrow-left'
  if (!event.shiftKey && event.key === 'ArrowRight') return 'arrow-right'
  if (!event.shiftKey && event.key === 'ArrowUp') return 'arrow-up'
  if (!event.shiftKey && event.key === 'ArrowDown') return 'arrow-down'
  return null
}

export function shouldLeaveCellForNav(
  cm: EditorView,
  command: TableKeyCommand
): boolean {
  const pos = readCellEdgePosition(cm)
  switch (command) {
    case 'arrow-left':
      return pos.left
    case 'arrow-right':
      return pos.right
    case 'arrow-up':
      return pos.top
    case 'arrow-down':
      return pos.bottom
    case 'tab':
    case 'enter':
      return true
    case 'shift-tab':
      return pos.left && pos.top
    default:
      return false
  }
}
