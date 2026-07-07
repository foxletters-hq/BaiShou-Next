import { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { setPreviewFrozen } from './livePreviewFreeze'

const MARKER_NODE_NAMES = new Set(['HeaderMark', 'ListMark', 'QuoteMark', 'TaskMarker', 'CodeMark'])

/** 将光标移出 Live Preview 会隐藏的语法标记，避免行首残留 #、-、< 等字符 */
export function resolvePreviewCursorPos(view: EditorView, desiredPos: number): number {
  const doc = view.state.doc
  let pos = Math.max(0, Math.min(desiredPos, doc.length))
  const line = doc.lineAt(pos)

  syntaxTree(view.state).iterate({
    from: line.from,
    to: line.to,
    enter(node) {
      if (node.from > pos) return false
      if (node.to < pos) return

      if (MARKER_NODE_NAMES.has(node.type.name) && pos >= node.from && pos < node.to) {
        pos = node.to
        return false
      }

      const levelMatch = /^ATXHeading(\d)$/.exec(node.type.name)
      if (levelMatch) {
        const text = doc.sliceString(node.from, node.to)
        const prefix = text.match(/^(#{1,6}\s?)/)
        const prefixEnd = prefix ? node.from + prefix[0].length : node.from
        if (pos < prefixEnd) {
          pos = prefixEnd
        }
        return false
      }

      if (node.type.name === 'Link' || node.type.name === 'URL') {
        const text = doc.sliceString(node.from, node.to)
        if (text.startsWith('<') && pos === node.from) {
          const close = text.indexOf('>')
          if (close > 0) {
            pos = node.from + close + 1
          }
        }
      }
    }
  })

  return Math.min(Math.max(pos, line.from), line.to)
}

/** 跳转到指定行/列，并确保 Live Preview 装饰与光标位置一致 */
export function placePreviewCursorAt(
  view: EditorView,
  lineNumber: number,
  column = 0
): void {
  const doc = view.state.doc
  if (doc.length === 0) return

  const safeLine = Math.min(Math.max(1, lineNumber), doc.lines)
  const line = doc.line(safeLine)
  const desired = Math.min(line.from + Math.max(0, column), line.to)
  const cursorPos = resolvePreviewCursorPos(view, desired)

  view.dispatch({
    selection: { anchor: cursorPos },
    effects: [EditorView.scrollIntoView(cursorPos, { y: 'center' }), setPreviewFrozen.of(false)]
  })
  view.focus()
}

/** 打开文档时将光标置于首行标题正文起始处，便于 Live Preview 隐藏 # */
export function placePreviewCursorPastHeading(view: EditorView): void {
  const doc = view.state.doc
  if (doc.length === 0) return

  const firstLine = doc.line(1)
  let cursorPos = firstLine.to

  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.from > firstLine.to || node.to < firstLine.from) return
      const levelMatch = /^ATXHeading(\d)$/.exec(node.type.name)
      if (!levelMatch) return
      const text = doc.sliceString(node.from, node.to)
      const prefix = text.match(/^(#{1,6}\s?)/)
      cursorPos = prefix ? node.from + prefix[0].length : node.to
      return false
    }
  })

  if (view.state.selection.main.head !== cursorPos) {
    view.dispatch({ selection: { anchor: cursorPos } })
  }
}
