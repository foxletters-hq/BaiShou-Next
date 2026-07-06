import type { EditorState } from '@codemirror/state'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { SyntaxNodeRef } from '@lezer/common'
import type { Decoration } from '@codemirror/view'
import {
  codeLineStyle,
  codeLineStyleBottom,
  codeLineStyleSingle,
  codeLineStyleTop,
  hideSyntaxReplaceSpec
} from './styles'
import { findFencedCodeBlockContaining, collectFencedCodeBlockRanges } from './fencedCodeScan'
import {
  pushLineDecoration,
  pushReplaceDecoration,
  type DecorationMark
} from './decorationMarks'
import type { DiaryCmPlatform } from '../types'

const FENCED_CODE_HIDEABLE = new Set(['CodeMark', 'CodeInfo'])

/** 围栏块覆盖的行号（Lezer + 行级扫描），行内语法装饰应跳过以避免 replace 重叠 */
export function collectFencedCodeProtectedLineNumbers(state: EditorState): Set<number> {
  const lines = new Set<number>()
  const doc = state.doc

  ensureSyntaxTree(state, doc.length, 200)
  syntaxTree(state).iterate({
    enter(node) {
      if (node.type.name !== 'FencedCode') return
      const first = doc.lineAt(node.from).number
      const last = doc.lineAt(node.to).number
      for (let n = first; n <= last; n += 1) lines.add(n)
    }
  })

  for (const block of collectFencedCodeBlockRanges(doc)) {
    const first = doc.lineAt(block.from).number
    const last = doc.lineAt(block.to).number
    for (let n = first; n <= last; n += 1) lines.add(n)
  }

  return lines
}

function pushFencedCodeLineStyle(
  marks: DecorationMark[],
  applied: Set<number>,
  lineNum: number,
  firstLineNum: number,
  lastLineNum: number,
  lineFrom: number
): void {
  if (applied.has(lineNum)) return
  applied.add(lineNum)

  let style = codeLineStyle
  if (firstLineNum === lastLineNum) {
    style = codeLineStyleSingle
  } else if (lineNum === firstLineNum) {
    style = codeLineStyleTop
  } else if (lineNum === lastLineNum) {
    style = codeLineStyleBottom
  }
  pushLineDecoration(marks, style, lineFrom)
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
  hasFocus: boolean,
  platform?: DiaryCmPlatform
): void {
  const doc = state.doc
  const hideSpec = hideSyntaxReplaceSpec(platform?.interactionMode === 'touch')
  ensureSyntaxTree(state, doc.length, 200)
  syntaxTree(state).iterate({
    enter(node) {
      if (!FENCED_CODE_HIDEABLE.has(node.type.name)) return
      const parent = node.node.parent
      if (!parent || parent.type.name !== 'FencedCode') return
      if (isFencedCodeSyntaxVisible(state, node.from, activeLines, hasFocus)) return
      pushReplaceDecoration(marks, doc, node.from, node.to, hideSpec)
    }
  })

  for (const block of collectFencedCodeBlockRanges(doc)) {
    if (!isFencedCodeSyntaxVisible(state, block.openFenceFrom, activeLines, hasFocus)) {
      pushReplaceDecoration(marks, doc, block.openFenceFrom, block.openFenceTo, hideSpec)
    }
    if (
      block.closeFenceFrom != null &&
      block.closeFenceTo != null &&
      !isFencedCodeSyntaxVisible(state, block.closeFenceFrom, activeLines, hasFocus)
    ) {
      pushReplaceDecoration(marks, doc, block.closeFenceFrom, block.closeFenceTo, hideSpec)
    }
  }
}

export function collectFencedCodeLineDecorations(
  state: EditorState,
  marks: DecorationMark[]
): void {
  const doc = state.doc
  const applied = new Set<number>()

  ensureSyntaxTree(state, doc.length, 200)
  syntaxTree(state).iterate({
    enter(node: SyntaxNodeRef) {
      if (node.type.name !== 'FencedCode') return
      const firstLineNum = doc.lineAt(node.from).number
      const lastLineNum = doc.lineAt(node.to).number
      for (let lineNum = firstLineNum; lineNum <= lastLineNum; lineNum += 1) {
        pushFencedCodeLineStyle(
          marks,
          applied,
          lineNum,
          firstLineNum,
          lastLineNum,
          doc.line(lineNum).from
        )
      }
      return false
    }
  })

  for (const block of collectFencedCodeBlockRanges(doc)) {
    const firstLineNum = doc.lineAt(block.from).number
    const lastLineNum = doc.lineAt(block.to).number
    for (let lineNum = firstLineNum; lineNum <= lastLineNum; lineNum += 1) {
      pushFencedCodeLineStyle(
        marks,
        applied,
        lineNum,
        firstLineNum,
        lastLineNum,
        doc.line(lineNum).from
      )
    }
  }
}
