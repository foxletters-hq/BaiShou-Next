import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import { collectImageDecorations } from './buildImages'
import { forceImageRefresh } from './effects'
import { getCursorPositions } from './cursor'
import type { DiaryCmPlatform } from '../types'

const VIEWPORT_BUFFER_LINES = 10

function expandVisibleRanges(view: EditorView): { from: number; to: number }[] {
  const doc = view.state.doc
  return view.visibleRanges.map(({ from, to }) => {
    const startLine = doc.lineAt(from).number
    const endLine = doc.lineAt(Math.min(to, doc.length)).number
    const bufStart = Math.max(1, startLine - VIEWPORT_BUFFER_LINES)
    const bufEnd = Math.min(doc.lines, endLine + VIEWPORT_BUFFER_LINES)
    return { from: doc.line(bufStart).from, to: doc.line(bufEnd).to }
  })
}

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

/** 仅对视口附近的图片创建完整 widget，其余用占位符 */
export function imagePreviewPlugin(
  resolveUrlOrPlatform?: ((url: string) => string) | DiaryCmPlatform
) {
  const platform = normalizePlatform(resolveUrlOrPlatform)

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none

      constructor(view: EditorView) {
        this.decorations = this.build(view)
      }

      update(update: ViewUpdate) {
        const needsRefresh =
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.transactions.some((t) => t.effects.some((e) => e.is(forceImageRefresh)))

        if (needsRefresh) {
          this.decorations = this.build(update.view)
        } else {
          this.decorations = this.decorations.map(update.changes)
        }
      }

      build(view: EditorView): DecorationSet {
        const marks: { from: number; to: number; value: Decoration }[] = []
        const cursors = getCursorPositions(view.state)
        collectImageDecorations(view.state, cursors, platform, marks, {
          visibleRanges: expandVisibleRanges(view),
          offscreenPlaceholder: true
        })
        return marks.length > 0 ? Decoration.set(marks, true) : Decoration.none
      }
    },
    { decorations: (plugin) => plugin.decorations }
  )
}
