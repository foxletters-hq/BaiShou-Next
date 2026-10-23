import { EditorView, keymap } from '@codemirror/view'
import { EditorSelection, Prec } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { resolvePostTableCursor } from '../table/tablePostGap'
import { logTableDesktop } from '../table/tableDesktopDebug'
import { getCursorPositions, isCursorInRange } from './cursor'

export function isOnPostTableInputLine(
  view: EditorView,
  head: number,
  tableRowTo: number
): boolean {
  if (head <= tableRowTo) return false
  const doc = view.state.doc
  const { cursor } = resolvePostTableCursor(doc, tableRowTo)
  try {
    return doc.lineAt(head).number === doc.lineAt(cursor).number
  } catch {
    return false
  }
}

/** 表边界 Backspace/Delete：先选中整张表，再次删除才移除 */
function selectTableBeforeCaret(view: EditorView): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const pos = sel.head
  if (pos === 0) return false

  const tree = syntaxTree(state)
  let tableBefore: SyntaxNode | null = null

  tree.iterate({
    from: Math.max(0, pos - 2),
    to: pos,
    enter(n) {
      if (n.name !== 'Table') return
      if (n.to === pos || n.to + 1 === pos) {
        tableBefore = n.node
      }
    }
  })

  if (!tableBefore) return false

  const range = tableBefore
  logTableDesktop('boundary:select-table', { from: range.from, to: range.to, head: pos })
  view.dispatch({
    selection: EditorSelection.range(range.from, range.to)
  })
  return true
}

export function backspaceAtTableBoundary(view: EditorView): boolean {
  return selectTableBeforeCaret(view)
}

export function deleteAtTableBoundary(view: EditorView): boolean {
  return selectTableBeforeCaret(view)
}

export const tableBoundaryBackspaceKeymap = Prec.high(
  keymap.of([
    { key: 'Backspace', run: backspaceAtTableBoundary },
    { key: 'Delete', run: deleteAtTableBoundary }
  ])
)

export function isCursorInsideTable(view: EditorView): boolean {
  const cursors = getCursorPositions(view.state)
  const tree = syntaxTree(view.state)
  let inside = false
  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      if (cursors.some((c) => isCursorInRange(node.from, node.to, [c]))) {
        inside = true
        return false
      }
    }
  })
  return inside
}
