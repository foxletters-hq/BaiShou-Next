import { Decoration, type EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNodeRef } from '@lezer/common'
import {
  codeBlockMark,
  codeLineStyle,
  codeLineStyleBottom,
  codeLineStyleSingle,
  codeLineStyleTop,
  codeMarkStyle,
  headingStyles,
  hideMark,
  linkMark
} from './styles'
import { isCursorInRange, isCursorOnLine } from './cursor'
import type { ImageRange } from './buildImages'

type DecorationMark = { from: number; to: number; value: Decoration }

function pushDecoration(
  marks: DecorationMark[],
  value: Decoration,
  from: number,
  to: number
): void {
  if (from < to) marks.push(value.range(from, to))
}

export function collectTreeDecorations(
  view: EditorView,
  cursors: number[],
  imageRanges: ImageRange[],
  marks: DecorationMark[]
): void {
  const tree = syntaxTree(view.state)
  const doc = view.state.doc

  tree.iterate({
    enter(node: SyntaxNodeRef) {
      const insideImage = imageRanges.some((r) => node.from >= r.from && node.to <= r.to)
      if (insideImage) {
        return false
      }

      const line = doc.lineAt(node.from)
      const onActiveLine = isCursorOnLine(line.from, line.to, cursors)
      const name = node.type.name

      if (name === 'FencedCode') {
        pushDecoration(marks, codeBlockMark, node.from, node.to)

        const startLine = doc.lineAt(node.from).number
        const endLine = doc.lineAt(node.to).number
        for (let l = startLine; l <= endLine; l++) {
          const curLine = doc.line(l)
          let style = codeLineStyle
          if (startLine === endLine) {
            style = codeLineStyleSingle
          } else if (l === startLine) {
            style = codeLineStyleTop
          } else if (l === endLine) {
            style = codeLineStyleBottom
          }
          marks.push(style.range(curLine.from))
        }
        return false
      }

      if (name === 'CodeMark') {
        const parent = node.node.parent
        if (parent && parent.type.name === 'FencedCode') {
          pushDecoration(marks, codeMarkStyle, node.from, node.to)
          return
        }
        if (!onActiveLine) {
          pushDecoration(marks, hideMark, node.from, node.to)
        }
        return
      }

      if (name.startsWith('ATXHeading')) {
        const text = doc.sliceString(node.from, node.to)
        const match = text.match(/^(#{1,6})\s?/)
        if (match) {
          const prefixEnd = node.from + match[0].length
          const cursorInMarker = isCursorInRange(node.from, prefixEnd, cursors)
          if (!onActiveLine || !cursorInMarker) {
            pushDecoration(marks, hideMark, node.from, prefixEnd)
          }
          const level = match[1]!.length
          pushDecoration(
            marks,
            headingStyles[level]!,
            cursorInMarker ? node.from : prefixEnd,
            node.to
          )
        }
        return
      }

      if (name === 'StrongEmphasis') {
        const text = doc.sliceString(node.from, node.to)
        const openLen = text.startsWith('**') || text.startsWith('__') ? 2 : 1
        const closeLen = text.endsWith('**') || text.endsWith('__') ? 2 : 1
        const from = node.from
        const to = node.to
        const cursorInOpen = isCursorInRange(from, from + openLen, cursors)
        const cursorInClose = isCursorInRange(to - closeLen, to, cursors)
        if (!cursorInOpen) pushDecoration(marks, hideMark, from, from + openLen)
        if (!cursorInClose) pushDecoration(marks, hideMark, to - closeLen, to)
        return
      }

      if (name === 'Emphasis') {
        const text = doc.sliceString(node.from, node.to)
        if (text.length < 3) return
        const from = node.from
        const to = node.to
        const cursorInOpen = isCursorInRange(from, from + 1, cursors)
        const cursorInClose = isCursorInRange(to - 1, to, cursors)
        if (!cursorInOpen) pushDecoration(marks, hideMark, from, from + 1)
        if (!cursorInClose) pushDecoration(marks, hideMark, to - 1, to)
        return
      }

      if (name === 'Strikethrough') {
        const from = node.from
        const to = node.to
        const cursorInOpen = isCursorInRange(from, from + 2, cursors)
        const cursorInClose = isCursorInRange(to - 2, to, cursors)
        if (!cursorInOpen) pushDecoration(marks, hideMark, from, from + 2)
        if (!cursorInClose) pushDecoration(marks, hideMark, to - 2, to)
        return
      }

      if (name === 'InlineCode') {
        const text = doc.sliceString(node.from, node.to)
        const tickLen = text.startsWith('``') ? 2 : 1
        const from = node.from
        const to = node.to
        const cursorInOpen = isCursorInRange(from, from + tickLen, cursors)
        const cursorInClose = isCursorInRange(to - tickLen, to, cursors)
        if (!cursorInOpen) pushDecoration(marks, hideMark, from, from + tickLen)
        if (!cursorInClose) pushDecoration(marks, hideMark, to - tickLen, to)
        return
      }

      if (name === 'Link') {
        const text = doc.sliceString(node.from, node.to)
        const bracketOpen = text.indexOf('[')
        const bracketClose = text.indexOf('](')
        if (bracketOpen !== -1 && bracketClose !== -1) {
          const openFrom = node.from + bracketOpen
          const closeFrom = node.from + bracketClose
          const cursorInOpen = isCursorInRange(openFrom, openFrom + 1, cursors)
          const cursorInClose = isCursorInRange(closeFrom, node.to, cursors)
          if (!cursorInOpen) pushDecoration(marks, hideMark, openFrom, openFrom + 1)
          if (!cursorInClose) pushDecoration(marks, hideMark, closeFrom, node.to)
          pushDecoration(marks, linkMark, openFrom + 1, closeFrom)
        }
        return
      }

      if (onActiveLine) return

      if (name === 'QuoteMark') {
        pushDecoration(marks, hideMark, node.from, node.to)
        return
      }

      if (name === 'ListMark') {
        pushDecoration(marks, hideMark, node.from, node.to)
        return
      }

      if (name === 'TaskMarker') {
        pushDecoration(marks, hideMark, node.from, node.to)
      }
    }
  })
}
