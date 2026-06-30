import { Decoration, DecorationSet, type EditorView } from '@codemirror/view'
import { getCursorPositions } from './cursor'
import { collectImageDecorations } from './buildImages'
import { collectListLineDecorations } from './buildList'
import { collectTreeDecorations } from './buildTree'
import type { DiaryCmPlatform } from '../types'

export function buildMarkerHidingDecorations(
  view: EditorView,
  platform?: DiaryCmPlatform
): DecorationSet {
  const cursors = getCursorPositions(view)
  const marks: { from: number; to: number; value: Decoration }[] = []
  const imageRanges = collectImageDecorations(view, cursors, platform, marks)
  collectListLineDecorations(view, cursors, marks)
  collectTreeDecorations(view, cursors, imageRanges, marks)
  return Decoration.set(marks, true)
}
