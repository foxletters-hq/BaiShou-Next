import type { EditorView } from '@codemirror/view'

/** 将屏幕坐标映射到嵌套 CM 文档偏移（对齐 ckant / 旧 tableWidgetSync） */
export function focusNestedEditorAtPoint(
  cm: EditorView,
  clientX: number,
  clientY: number
): boolean {
  const content = cm.dom.querySelector('.cm-content') as HTMLElement | null
  const doc = content?.ownerDocument
  if (!content || !doc) return false

  try {
    if (typeof doc.caretPositionFromPoint === 'function') {
      const pos = doc.caretPositionFromPoint(clientX, clientY)
      if (pos?.offsetNode && content.contains(pos.offsetNode)) {
        const offset = offsetInCmContent(content, pos.offsetNode, pos.offset)
        if (offset != null) {
          cm.dispatch({ selection: { anchor: offset, head: offset } })
          return true
        }
      }
    }
    if (typeof doc.caretRangeFromPoint === 'function') {
      const range = doc.caretRangeFromPoint(clientX, clientY)
      if (range?.startContainer && content.contains(range.startContainer)) {
        const offset = offsetInCmContent(content, range.startContainer, range.startOffset)
        if (offset != null) {
          cm.dispatch({ selection: { anchor: offset, head: offset } })
          return true
        }
      }
    }
  } catch {
    // ignore
  }
  return false
}

function offsetInCmContent(content: HTMLElement, node: Node, offset: number): number | null {
  const walker = content.ownerDocument.createTreeWalker(content, NodeFilter.SHOW_TEXT)
  let total = 0
  while (walker.nextNode()) {
    const text = walker.currentNode
    if (text === node) return total + offset
    total += (text.textContent ?? '').length
  }
  return null
}
