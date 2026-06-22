import { ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'
import { forceImageRefresh } from './effects'
import { buildMarkerHidingDecorations } from './build'
import type { DiaryCmPlatform } from '../types'

function normalizePlatform(
  resolveUrlOrPlatform?: ((url: string) => string) | DiaryCmPlatform
): DiaryCmPlatform | undefined {
  if (!resolveUrlOrPlatform) return undefined
  if (typeof resolveUrlOrPlatform === 'function') {
    return {
      resolveAttachmentUrl: resolveUrlOrPlatform,
      interactionMode: 'mouse'
    }
  }
  return resolveUrlOrPlatform
}

export function livePreviewPlugin(
  resolveUrlOrPlatform?: ((url: string) => string) | DiaryCmPlatform
) {
  const platform = normalizePlatform(resolveUrlOrPlatform)

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = buildMarkerHidingDecorations(view, platform)
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.transactions.some((t) => t.effects.some((e) => e.is(forceImageRefresh)))
        ) {
          this.decorations = buildMarkerHidingDecorations(update.view, platform)
        }
      }
    },
    { decorations: (v) => v.decorations }
  )
}
