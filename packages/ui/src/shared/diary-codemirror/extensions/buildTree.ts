import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNodeRef } from '@lezer/common'
import { hideSyntaxReplaceSpec, inlineCodeMark, linkMark } from './styles'
import type { ImageRange } from './buildImages'
import { rangeOverlapsTableBlocks, type TableBlockRange } from './buildTableChrome'
import { pushReplaceDecoration } from './decorationMarks'
import {
  markdownInlineLinkPreviewRanges,
  selectionTouchesLinkRange
} from './markdown-link-preview.util'
import type { DiaryCmPlatform } from '../types'

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
    for (let n = firstLine; n <= lastLine; n += 1) activeLines.add(n)
  }
  return activeLines
}

/** 语法树装饰：链接等（围栏代码由 buildFencedCode 处理） */
export function collectTreeDecorations(
  state: EditorState,
  _activeLines: Set<number>,
  imageRanges: ImageRange[],
  marks: DecorationMark[],
  widgetizedTables: TableBlockRange[] = [],
  hasFocus = true,
  platform?: DiaryCmPlatform
): void {
  const tree = syntaxTree(state)
  const doc = state.doc
  const hideSpec = hideSyntaxReplaceSpec(platform?.interactionMode === 'touch')

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

      if (name === 'FencedCode' || name === 'CodeBlock') {
        return false
      }

      if (name === 'InlineCode' && node.from < node.to) {
        const alreadyMarked = marks.some(
          (mark) =>
            mark.from === node.from &&
            mark.to === node.to &&
            mark.value.spec.class === 'cm-rendered-inline-code'
        )
        if (!alreadyMarked) pushDecoration(marks, inlineCodeMark, node.from, node.to)
        return false
      }

      if (name !== 'Link' || node.from >= node.to) return

      const raw = doc.sliceString(node.from, node.to)
      const parts = markdownInlineLinkPreviewRanges(raw, node.from)
      if (!parts) return

      const editing =
        hasFocus && selectionTouchesLinkRange(state.selection.ranges, node.from, node.to)
      if (editing) return

      for (const range of parts.hideRanges) {
        pushReplaceDecoration(marks, doc, range.from, range.to, hideSpec)
      }
      pushDecoration(marks, linkMark, parts.labelFrom, parts.labelTo)
    }
  })
}

export function getActiveLinesForDecorations(state: EditorState, hasFocus: boolean): Set<number> {
  return collectActiveLines(state, hasFocus)
}
