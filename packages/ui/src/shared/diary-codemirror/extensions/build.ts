import type { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { Decoration, DecorationSet } from '@codemirror/view'
import { getCursorPositions } from './cursor'
import { scanImageRanges } from './buildImages'
import { collectListLineDecorations } from './buildList'
import { collectLineSyntaxDecorations } from './buildLineSyntax'
import { collectTableDecorations } from './buildTable'
import { collectTableBlockRanges } from './buildTableChrome'
import { collectTreeDecorations, getActiveLinesForDecorations } from './buildTree'
import {
  collectFencedCodeLineDecorations,
  collectFencedCodeMarkDecorations,
  expandActiveLinesForFencedCode
} from './buildFencedCode'
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
  expandActiveLinesForFencedCode(state, activeLines)
  const marks: { from: number; to: number; value: Decoration }[] = []
  const imageRanges = scanImageRanges(state)
  collectListLineDecorations(state, cursors, marks)
  collectLineSyntaxDecorations(state, activeLines, marks)
  const tableBlocks = collectTableBlockRanges(state)
  if (platform?.interactionMode !== 'touch') {
    collectTableDecorations(state, cursors, marks, tableBlocks)
  }
  collectFencedCodeLineDecorations(state, marks)
  collectTreeDecorations(state, activeLines, imageRanges, marks, tableBlocks, hasFocus, platform)
  collectFencedCodeMarkDecorations(state, marks, activeLines, hasFocus)
  return Decoration.set(marks, true)
}
