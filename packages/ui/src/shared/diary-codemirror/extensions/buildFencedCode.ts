import type { EditorState } from '@codemirror/state'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { SyntaxNodeRef } from '@lezer/common'
import type { Decoration } from '@codemirror/view'
import {
  codeLineStyle,
  codeLineStyleBottom,
  codeLineStyleSingle,
  codeLineStyleTop,
  hideSyntaxReplace
} from './styles'
import { findFencedCodeBlockContaining } from './fencedCodeScan'

type DecorationMark = { from: number; to: number; value: Decoration }

const FENCED_CODE_HIDEABLE = new Set(['CodeMark', 'CodeInfo'])

function pushDecoration(
  marks: DecorationMark[],
  value: Decoration,
  from: number,
  to: number
): void {
  if (from < to) marks.push(value.range(from, to))
}

/** 光标落在围栏块任一行时，整块行均视为 active（对齐 inline live preview） */
export function expandActiveLinesForFencedCode(state: EditorState, activeLines: Set<number>): void {
  const doc = state.doc
  const head = state.selection.main.head
  const blockByCursor = findFencedCodeBlockContaining(doc, head)
  if (blockByCursor) {
    const firstLine = doc.lineAt(blockByCursor.from).number
    const lastLine = doc.lineAt(blockByCursor.to).number
    for (let n = firstLine; n <= lastLine; n += 1) activeLines.add(n)
  }

  ensureSyntaxTree(state, doc.length, 200)
  syntaxTree(state).iterate({
    enter(node) {
      if (node.type.name !== 'FencedCode') return
      const firstLine = doc.lineAt(node.from).number
      const lastLine = doc.lineAt(node.to).number
      let anyActive = false
      for (let n = firstLine; n <= lastLine; n += 1) {
        if (activeLines.has(n)) {
          anyActive = true
          break
        }
      }
      if (!anyActive) return
      for (let n = firstLine; n <= lastLine; n += 1) activeLines.add(n)
    }
  })
}

export function isFencedCodeSyntaxVisible(
  state: EditorState,
  from: number,
  activeLines: Set<number>,
  hasFocus: boolean
): boolean {
  if (!hasFocus) return false
  return activeLines.has(state.doc.lineAt(from).number)
}

/** 独立遍历围栏语法 token，避免 FencedCode enter 中 return false 跳过子节点 */
export function collectFencedCodeMarkDecorations(
  state: EditorState,
  marks: DecorationMark[],
  activeLines: Set<number>,
  hasFocus: boolean
): void {
  ensureSyntaxTree(state, state.doc.length, 200)
  syntaxTree(state).iterate({
    enter(node) {
      if (!FENCED_CODE_HIDEABLE.has(node.type.name)) return
      const parent = node.node.parent
      if (!parent || parent.type.name !== 'FencedCode') return
      if (isFencedCodeSyntaxVisible(state, node.from, activeLines, hasFocus)) return
      pushDecoration(marks, hideSyntaxReplace, node.from, node.to)
    }
  })
}

export function collectFencedCodeLineDecorations(
  state: EditorState,
  marks: DecorationMark[]
): void {
  const doc = state.doc
  ensureSyntaxTree(state, doc.length, 200)
  syntaxTree(state).iterate({
    enter(node: SyntaxNodeRef) {
      if (node.type.name !== 'FencedCode') return
      const firstLineNum = doc.lineAt(node.from).number
      const lastLineNum = doc.lineAt(node.to).number

      for (let lineNum = firstLineNum; lineNum <= lastLineNum; lineNum += 1) {
        const line = doc.line(lineNum)
        let style = codeLineStyle
        if (firstLineNum === lastLineNum) {
          style = codeLineStyleSingle
        } else if (lineNum === firstLineNum) {
          style = codeLineStyleTop
        } else if (lineNum === lastLineNum) {
          style = codeLineStyleBottom
        }
        marks.push(style.range(line.from))
      }
      return false
    }
  })
}
