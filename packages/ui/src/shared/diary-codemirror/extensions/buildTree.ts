import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNodeRef } from '@lezer/common'
import { linkMark } from './styles'
import type { ImageRange } from './buildImages'
import { rangeOverlapsTableBlocks, type TableBlockRange } from './buildTableChrome'
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
  _platform?: DiaryCmPlatform
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
    }
  })
}

export function getActiveLinesForDecorations(state: EditorState, hasFocus: boolean): Set<number> {
  return collectActiveLines(state, hasFocus)
}
