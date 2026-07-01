import { StateField, type Transaction } from '@codemirror/state'
import { EditorView, type DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { forceImageRefresh } from './effects'
import { forceTableRefresh, pendingTableCellFocus } from '../table/tableEffects'
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

function shouldRebuildDecorations(tr: Transaction): boolean {
  if (tr.docChanged) return true
  if (!tr.startState.selection.eq(tr.state.selection)) return true
  if (syntaxTree(tr.state) !== syntaxTree(tr.startState)) return true
  return tr.effects.some((e) => e.is(forceImageRefresh) || e.is(forceTableRefresh))
}

/** 块级 replace 装饰必须通过 StateField 提供，不能放在 ViewPlugin 里 */
export function livePreviewPlugin(
  resolveUrlOrPlatform?: ((url: string) => string) | DiaryCmPlatform
) {
  const platform = normalizePlatform(resolveUrlOrPlatform)

  return StateField.define<DecorationSet>({
    create(state) {
      return buildMarkerHidingDecorations(state, platform)
    },
    update(deco, tr) {
      if (shouldRebuildDecorations(tr)) {
        return buildMarkerHidingDecorations(tr.state, platform)
      }
      return deco.map(tr.changes)
    },
    provide: (field) => EditorView.decorations.from(field)
  })
}
