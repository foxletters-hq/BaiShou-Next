import { Decoration, DecorationSet, type EditorView } from '@codemirror/view'
import { getCursorPositions } from './codeMirrorDecorations.cursor'
import { collectImageDecorations } from './codeMirrorDecorations.buildImages'
import { collectTreeDecorations } from './codeMirrorDecorations.buildTree'

export function buildMarkerHidingDecorations(
  view: EditorView,
  resolveUrl?: (url: string) => string
): DecorationSet {
  const cursors = getCursorPositions(view)
  const marks: { from: number; to: number; value: Decoration }[] = []
  const imageRanges = collectImageDecorations(view, cursors, resolveUrl, marks)
  collectTreeDecorations(view, cursors, imageRanges, marks)
  return Decoration.set(marks, true)
}
