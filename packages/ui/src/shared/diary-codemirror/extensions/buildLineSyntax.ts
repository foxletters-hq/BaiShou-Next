import type { EditorState } from '@codemirror/state'
import type { Decoration } from '@codemirror/view'
import { hideSyntaxReplace } from './styles'

type DecorationMark = { from: number; to: number; value: Decoration }

const ATX_HEADING_PREFIX_RE = /^(#{1,6})\s?/
const BLOCKQUOTE_PREFIX_RE = /^(\s*>\s?)/
const STRONG_WRAPPER_RE = /\*\*(.+?)\*\*/g
const EMPHASIS_WRAPPER_RE = /(?<!\*)\*([^*]+)\*(?!\*)/g
const INLINE_CODE_WRAPPER_RE = /`([^`]+)`/g
const STRIKETHROUGH_WRAPPER_RE = /~~(.+?)~~/g

function pushDecoration(
  marks: DecorationMark[],
  value: Decoration,
  from: number,
  to: number
): void {
  if (from < to) marks.push(value.range(from, to))
}

function hideDelimiterRuns(
  marks: DecorationMark[],
  lineFrom: number,
  text: string,
  re: RegExp,
  delimiterGroup: number
): void {
  re.lastIndex = 0
  let match = re.exec(text)
  while (match) {
    const full = match[0]
    const inner = match[delimiterGroup] ?? ''
    const openLen = full.indexOf(inner)
    const closeLen = full.length - openLen - inner.length
    if (openLen > 0) {
      pushDecoration(
        marks,
        hideSyntaxReplace,
        lineFrom + match.index,
        lineFrom + match.index + openLen
      )
    }
    if (closeLen > 0) {
      pushDecoration(
        marks,
        hideSyntaxReplace,
        lineFrom + match.index + openLen + inner.length,
        lineFrom + match.index + full.length
      )
    }
    match = re.exec(text)
  }
}

/**
 * 基于行文本的 live preview（与 buildList 同策略，不依赖语法树）。
 * RN WebView 上 Decoration.line / Decoration.mark 不进 DOM，但 widget replace 正常。
 */
export function collectLineSyntaxDecorations(
  state: EditorState,
  activeLines: Set<number>,
  marks: DecorationMark[]
): void {
  const doc = state.doc

  for (let lineNum = 1; lineNum <= doc.lines; lineNum += 1) {
    if (activeLines.has(lineNum)) continue

    const line = doc.line(lineNum)
    const text = line.text

    const heading = text.match(ATX_HEADING_PREFIX_RE)
    if (heading) {
      pushDecoration(marks, hideSyntaxReplace, line.from, line.from + heading[0].length)
      continue
    }

    const quote = text.match(BLOCKQUOTE_PREFIX_RE)
    if (quote) {
      pushDecoration(marks, hideSyntaxReplace, line.from, line.from + quote[0].length)
    }

    hideDelimiterRuns(marks, line.from, text, STRONG_WRAPPER_RE, 1)
    hideDelimiterRuns(marks, line.from, text, STRIKETHROUGH_WRAPPER_RE, 1)
    hideDelimiterRuns(marks, line.from, text, INLINE_CODE_WRAPPER_RE, 1)
    hideDelimiterRuns(marks, line.from, text, EMPHASIS_WRAPPER_RE, 1)
  }
}
