import type { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { Decoration, DecorationSet } from '@codemirror/view'
import { getCursorPositions } from './cursor'
import { collectImageDecorations } from './buildImages'
import { collectListLineDecorations } from './buildList'
import { collectTableDecorations } from './buildTable'
import { collectTableBlockRanges } from './buildTableChrome'
import { collectTreeDecorations } from './buildTree'
import type { DiaryCmPlatform } from '../types'

export function buildMarkerHidingDecorations(
  state: EditorState,
  platform?: DiaryCmPlatform
): DecorationSet {
  const cursors = getCursorPositions(state)
  const parseTo = Math.max(state.doc.length, ...cursors, 0)
  // 增量解析未追到光标时 ATXHeading 等节点缺失，移动端 WebView 上尤为明显
  ensureSyntaxTree(state, parseTo, 80)

  const marks: { from: number; to: number; value: Decoration }[] = []
  const imageRanges = collectImageDecorations(state, cursors, platform, marks)
  collectListLineDecorations(state, cursors, marks)
  const tableBlocks = collectTableBlockRanges(state)
  collectTableDecorations(state, cursors, marks, tableBlocks)
  collectTreeDecorations(state, cursors, imageRanges, marks, tableBlocks)
  return Decoration.set(marks, true)
}
