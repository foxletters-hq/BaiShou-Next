import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNodeRef } from '@lezer/common'
import {
  codeBlockMark,
  codeLineStyle,
  codeLineStyleBottom,
  codeLineStyleSingle,
  codeLineStyleTop,
  codeMarkStyle,
  linkMark
} from './styles'
import type { ImageRange } from './buildImages'
import { rangeOverlapsTableBlocks, type TableBlockRange } from './buildTableChrome'

type DecorationMark = { from: number; to: number; value: Decoration }

function pushDecoration(
  marks: DecorationMark[],
  value: Decoration,
  from: number,
  to: number
): void {
  if (from < to) marks.push(value.range(from, to))
}

function collectActiveLines(state: EditorState, hasFocus: boolean): Set<number> {
  const activeLines = new Set<number>()
  if (!hasFocus) return activeLines
  const { doc } = state
  for (const range of state.selection.ranges) {
    const firstLine = doc.lineAt(range.from).number
    const lastLine = doc.lineAt(range.to).number
    for (let n = firstLine; n <= lastLine; n++) activeLines.add(n)
  }
  return activeLines
}

/** 语法树装饰：围栏代码、链接等（行级标题/引用/行内隐藏由 buildLineSyntax 处理） */
export function collectTreeDecorations(
  state: EditorState,
  activeLines: Set<number>,
  imageRanges: ImageRange[],
  marks: DecorationMark[],
  widgetizedTables: TableBlockRange[] = [],
  hasFocus = true
): void {
  const tree = syntaxTree(state)
  const doc = state.doc
  const activeLinkStarts = new Set<number>()

  tree.iterate({
    enter(node: SyntaxNodeRef) {
      if (rangeOverlapsTableBlocks(node.from, node.to, widgetizedTables)) {
        return false
      }

      const insideImage = imageRanges.some((r) => node.from >= r.from && node.to <= r.to)
      if (insideImage) {
        return false
      }

      const name = node.type.name

      if (name === 'FencedCode') {
        const firstLineNum = doc.lineAt(node.from).number
        const lastLineNum = doc.lineAt(node.to).number
        let anyActive = false
        for (let n = firstLineNum; n <= lastLineNum; n++) {
          if (activeLines.has(n)) {
            anyActive = true
            break
          }
        }
        if (anyActive) {
          for (let n = firstLineNum; n <= lastLineNum; n++) activeLines.add(n)
        }

        pushDecoration(marks, codeBlockMark, node.from, node.to)

        for (let l = firstLineNum; l <= lastLineNum; l++) {
          const curLine = doc.line(l)
          let style = codeLineStyle
          if (firstLineNum === lastLineNum) {
            style = codeLineStyleSingle
          } else if (l === firstLineNum) {
            style = codeLineStyleTop
          } else if (l === lastLineNum) {
            style = codeLineStyleBottom
          }
          marks.push(style.range(curLine.from))
        }
        return false
      }

      if (name === 'Link' && hasFocus) {
        for (const range of state.selection.ranges) {
          if (range.from <= node.to && range.to >= node.from) {
            activeLinkStarts.add(node.from)
            break
          }
        }
      }

      if (name === 'Link' && node.from < node.to) {
        const text = doc.sliceString(node.from, node.to)
        const bracketOpen = text.indexOf('[')
        const bracketClose = text.indexOf('](')
        if (bracketOpen !== -1 && bracketClose !== -1) {
          const openFrom = node.from + bracketOpen
          const closeFrom = node.from + bracketClose
          if (!activeLinkStarts.has(node.from)) {
            pushDecoration(marks, linkMark, openFrom + 1, closeFrom)
          }
        }
      }

      if (name === 'CodeMark') {
        const parent = node.node.parent
        if (parent && parent.type.name === 'FencedCode') {
          pushDecoration(marks, codeMarkStyle, node.from, node.to)
        }
      }
    }
  })
}

export function getActiveLinesForDecorations(
  state: EditorState,
  hasFocus: boolean
): Set<number> {
  return collectActiveLines(state, hasFocus)
}
