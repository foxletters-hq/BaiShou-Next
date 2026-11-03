import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import { collectImageDecorations } from './buildImages'
import { forceImageRefresh } from './effects'
import { getCursorPositions } from './cursor'
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

/** 独立图片预览插件（当前主流程已并入 livePreviewField 统一构建装饰） */
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
        collectImageDecorations(view.state, cursors, platform, marks)
        return marks.length > 0 ? Decoration.set(marks, true) : Decoration.none
      }
    },
    { decorations: (plugin) => plugin.decorations }
  )
}
