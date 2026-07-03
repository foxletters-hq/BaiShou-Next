import type { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { Decoration, DecorationSet } from '@codemirror/view'
import { getCursorPositions } from './cursor'
import { collectImageDecorations } from './buildImages'
import { collectListLineDecorations } from './buildList'
import { collectLineSyntaxDecorations } from './buildLineSyntax'
import { collectTableDecorations } from './buildTable'
import { collectTableBlockRanges } from './buildTableChrome'
import { collectTreeDecorations, getActiveLinesForDecorations } from './buildTree'
import type { DiaryCmPlatform } from '../types'

export interface BuildMarkerHidingOptions {
  hasFocus?: boolean
}

export function buildMarkerHidingDecorations(
  state: EditorState,
  platform?: DiaryCmPlatform,
  options?: BuildMarkerHidingOptions
): DecorationSet {
  const cursors = getCursorPositions(state)
  const parseTo = Math.max(state.doc.length, ...cursors, 0)
  ensureSyntaxTree(state, parseTo, 200)

  const hasFocus = options?.hasFocus ?? true
  const activeLines = getActiveLinesForDecorations(state, hasFocus)
  const marks: { from: number; to: number; value: Decoration }[] = []
  const imageRanges = collectImageDecorations(state, cursors, platform, marks)
  collectListLineDecorations(state, cursors, marks)
  collectLineSyntaxDecorations(state, activeLines, marks)
  const tableBlocks = collectTableBlockRanges(state)
  collectTableDecorations(state, cursors, marks, tableBlocks)
  collectTreeDecorations(state, activeLines, imageRanges, marks, tableBlocks, hasFocus)
  return Decoration.set(marks, true)
}
