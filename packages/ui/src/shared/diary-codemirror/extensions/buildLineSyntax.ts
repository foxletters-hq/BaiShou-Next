import type { EditorState } from '@codemirror/state'
import { blockquoteLineStyle, hideSyntaxReplaceSpec } from './styles'
import {
  pushLineDecoration,
  pushReplaceDecoration,
  type DecorationMark
} from './decorationMarks'
import type { DiaryCmPlatform } from '../types'

const ATX_HEADING_PREFIX_RE = /^(#{1,6})\s?/
const BLOCKQUOTE_PREFIX_RE = /^(\s*>\s?)/
const STRONG_WRAPPER_RE = /\*\*(.+?)\*\*/g
const EMPHASIS_WRAPPER_RE = /(?<!\*)\*([^*]+)\*(?!\*)/g
const INLINE_CODE_WRAPPER_RE = /`([^`]+)`/g
const STRIKETHROUGH_WRAPPER_RE = /~~(.+?)~~/g

function selectionIntersectsRange(state: EditorState, from: number, to: number): boolean {
  for (const range of state.selection.ranges) {
    if (range.from < to && range.to > from) return true
  }
  return false
}

function hideDelimiterRuns(
  marks: DecorationMark[],
  doc: EditorState['doc'],
  hideSpec: Parameters<typeof import('@codemirror/view').Decoration.replace>[0],
  lineFrom: number,
  text: string,
  re: RegExp,
  delimiterGroup: number,
  state: EditorState
): void {
  re.lastIndex = 0
  let match = re.exec(text)
  while (match) {
    const full = match[0]
    const inner = match[delimiterGroup] ?? ''
    const openLen = full.indexOf(inner)
    const closeLen = full.length - openLen - inner.length
    const runFrom = lineFrom + match.index
    const runTo = lineFrom + match.index + full.length

    if (!selectionIntersectsRange(state, runFrom, runTo)) {
      if (openLen > 0) {
        pushReplaceDecoration(
          marks,
          doc,
          lineFrom + match.index,
          lineFrom + match.index + openLen,
          hideSpec
        )
      }
      if (closeLen > 0) {
        pushReplaceDecoration(
          marks,
          doc,
          lineFrom + match.index + openLen + inner.length,
          lineFrom + match.index + full.length,
          hideSpec
        )
      }
    }
    match = re.exec(text)
  }
}

export function collectLineSyntaxDecorations(
  state: EditorState,
  activeLines: Set<number>,
  marks: DecorationMark[],
  skipLineNumbers: Set<number> | undefined,
  platform?: DiaryCmPlatform
): void {
  const doc = state.doc
  const hideSpec = hideSyntaxReplaceSpec(platform?.interactionMode === 'touch')

  for (let lineNum = 1; lineNum <= doc.lines; lineNum += 1) {
    if (skipLineNumbers?.has(lineNum)) continue
    const line = doc.line(lineNum)
    const text = line.text
    const isActiveLine = activeLines.has(lineNum)

    const heading = text.match(ATX_HEADING_PREFIX_RE)
    if (heading) {
      if (!isActiveLine) {
        pushReplaceDecoration(marks, doc, line.from, line.from + heading[0].length, hideSpec)
      }
      continue
    }

    const quote = text.match(BLOCKQUOTE_PREFIX_RE)
    if (quote && !isActiveLine) {
      pushReplaceDecoration(marks, doc, line.from, line.from + quote[0].length, hideSpec)
      pushLineDecoration(marks, blockquoteLineStyle, line.from)
    }

    hideDelimiterRuns(marks, doc, hideSpec, line.from, text, STRONG_WRAPPER_RE, 1, state)
    hideDelimiterRuns(marks, doc, hideSpec, line.from, text, STRIKETHROUGH_WRAPPER_RE, 1, state)
    if (!text.includes('```')) {
      hideDelimiterRuns(marks, doc, hideSpec, line.from, text, INLINE_CODE_WRAPPER_RE, 1, state)
    }
    hideDelimiterRuns(marks, doc, hideSpec, line.from, text, EMPHASIS_WRAPPER_RE, 1, state)
  }
}
