import type { EditorState } from '@codemirror/state'
import { Decoration, DecorationSet } from '@codemirror/view'
import { getCursorPositions } from './cursor'
import { collectImageDecorations } from './buildImages'
import { collectListLineDecorations } from './buildList'
import { collectTableDecorations } from './buildTable'
import { collectTableBlockWidgets } from './buildTableChrome'
import { collectTreeDecorations } from './buildTree'
import type { DiaryCmPlatform } from '../types'

export function buildMarkerHidingDecorations(
  state: EditorState,
  platform?: DiaryCmPlatform
): DecorationSet {
  const cursors = getCursorPositions(state)
  const marks: { from: number; to: number; value: Decoration }[] = []
  const imageRanges = collectImageDecorations(state, cursors, platform, marks)
  collectListLineDecorations(state, cursors, marks)
  const tableBlocks = collectTableBlockWidgets(state, cursors, marks, platform)
  collectTableDecorations(state, cursors, marks, tableBlocks)
  collectTreeDecorations(state, cursors, imageRanges, marks, tableBlocks)
  return Decoration.set(marks, true)
}
