import { StateEffect, StateField, type Extension, type Transaction } from '@codemirror/state'
import { DecorationSet, EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { forceImageRefresh } from './effects'
import { diarySyntaxTreeGrowthEffect } from './diarySyntaxTreeGrowth'
import { buildMarkerHidingDecorations } from './build'
import {
  livePreviewFreezePlugin,
  previewFrozenField,
  setPreviewFrozen
} from './livePreviewFreeze'
import type { DiaryCmPlatform } from '../types'

const editorFocusEffect = StateEffect.define<boolean>()

export { editorFocusEffect }

const editorFocusField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(editorFocusEffect)) return effect.value
    }
    return value
  }
})

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

function shouldRebuildLivePreview(tr: Transaction): boolean {
  if (tr.state.field(previewFrozenField)) {
    if (tr.effects.some((e) => e.is(setPreviewFrozen) && e.value === false)) {
      return true
    }
    if (tr.docChanged) return true
    // 点击进围栏块时需立刻根据 selection/focus 显隐 ```，不能等 freeze 结束
    if (tr.selectionSet) return true
    if (tr.effects.some((e) => e.is(editorFocusEffect))) return true
    return false
  }
  if (tr.docChanged) return true
  if (tr.selectionSet) return true
  if (syntaxTree(tr.state) !== syntaxTree(tr.startState)) return true
  if (tr.effects.some((e) => e.is(editorFocusEffect))) return true
  return tr.effects.some((e) =>
    e.is(forceImageRefresh) || e.is(diarySyntaxTreeGrowthEffect)
  )
}

/**
 * 行内 live preview 装饰（表格 widget 由 tablePreviewField 独立提供）。
 */
export function livePreviewField(
  resolveUrlOrPlatform?: ((url: string) => string) | DiaryCmPlatform
): Extension[] {
  const platform = normalizePlatform(resolveUrlOrPlatform)

  const livePreviewDecorationsField = StateField.define<DecorationSet>({
    create(state) {
      return buildMarkerHidingDecorations(state, platform, { hasFocus: false })
    },
    update(deco, tr) {
      if (shouldRebuildLivePreview(tr)) {
        const hasFocus = tr.state.field(editorFocusField)
        return buildMarkerHidingDecorations(tr.state, platform, { hasFocus })
      }
      if (tr.docChanged) return deco.map(tr.changes)
      return deco
    },
    provide: (f) => EditorView.decorations.from(f)
  })

  return [
    editorFocusField,
    previewFrozenField,
    livePreviewFreezePlugin(),
    EditorView.focusChangeEffect.of((_, focusing) => editorFocusEffect.of(focusing)),
    livePreviewDecorationsField
  ]
}

/** @deprecated 使用 livePreviewField（返回 Extension 数组，需展开） */
export function livePreviewPlugin(
  resolveUrlOrPlatform?: ((url: string) => string) | DiaryCmPlatform
): Extension[] {
  return livePreviewField(resolveUrlOrPlatform)
}
