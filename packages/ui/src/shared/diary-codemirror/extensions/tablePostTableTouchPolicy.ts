import type { EditorView } from '@codemirror/view'
import { findTableBlockAbovePoint } from '../table/tableEditorTouchCaret'

export function isChromeTouchBlocked(
  target: Element,
  isTableChromeTouchTarget: (el: Element) => HTMLElement | null,
  isInteractableChromeElement: (el: HTMLElement) => boolean
): boolean {
  if (target.closest('.cm-table-context-menu-layer, .cm-table-sheet-layer')) return true
  if (target.closest('.cm-table-cell-source')) return true
  if (target.closest('.cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn')) {
    return true
  }
  const chrome = isTableChromeTouchTarget(target)
  return !!(chrome && isInteractableChromeElement(chrome))
}

/**
 * 表格块 / 表后空白：Android WebView 在这些区域无法可靠落点。
 */
export function shouldExplicitCaretPlacement(
  view: EditorView,
  target: Element,
  clientY: number
): boolean {
  if (findTableBlockAbovePoint(view, clientY) != null) return true
  if (target.closest('.cm-table-block') && !target.closest('.cm-table-cell-source')) {
    return true
  }
  return false
}

/**
 * 触摸端正文交给 WebView 原生落点与选词；仅表格等特殊区域显式落光标。
 */
export function shouldPlaceCaretOnTapEnd(
  view: EditorView,
  target: Element,
  clientY: number,
  isTouch: boolean
): boolean {
  if (shouldExplicitCaretPlacement(view, target, clientY)) return true
  if (!isTouch && target.closest('.cm-content')) return true
  return false
}

export function hasEditorDomTextSelection(view: EditorView): boolean {
  const sel = view.dom.ownerDocument.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false
  const range = sel.getRangeAt(0)
  return view.contentDOM.contains(range.commonAncestorContainer)
}
