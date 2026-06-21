import { ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'
import { forceImageRefresh } from './codeMirrorDecorations.effects'
import { buildMarkerHidingDecorations } from './codeMirrorDecorations.build'

export function livePreviewPlugin(resolveUrl?: (url: string) => string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = buildMarkerHidingDecorations(view, resolveUrl)
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.transactions.some((t) => t.effects.some((e) => e.is(forceImageRefresh)))
        ) {
          this.decorations = buildMarkerHidingDecorations(update.view, resolveUrl)
        }
      }
    },
    { decorations: (v) => v.decorations }
  )
}
