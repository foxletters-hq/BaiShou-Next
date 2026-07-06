import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { editorFocusEffect } from './editorFocus'
import { findFencedCodeBlockContaining } from './fencedCodeScan'

const FREEZE_TAIL_MS = 100
/** 选区未折叠时延长冻结，避免 touchend 后立刻重建装饰导致高亮跳变 */
const SELECTION_FREEZE_TAIL_MS = 320

export const setPreviewFrozen = StateEffect.define<boolean>()

export const previewFrozenField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setPreviewFrozen)) return effect.value
    }
    return value
  }
})

/** 指针按下期间冻结 live preview 装饰重建，避免点击时围栏/标题语法显隐导致布局抖动 */
export function livePreviewFreezePlugin(): Extension {
  return ViewPlugin.fromClass(
    class {
      private down = false
      private releaseTimer: ReturnType<typeof setTimeout> | null = null

      constructor(private readonly view: EditorView) {
        this.view.contentDOM.addEventListener('pointerdown', this.onDown, true)
        this.view.contentDOM.addEventListener('touchstart', this.onDown, {
          capture: true,
          passive: true
        })
        window.addEventListener('pointerup', this.onUp)
        window.addEventListener('touchend', this.onUp, { passive: true })
        window.addEventListener('touchcancel', this.onUp, { passive: true })
      }

      destroy(): void {
        this.view.contentDOM.removeEventListener('pointerdown', this.onDown, true)
        this.view.contentDOM.removeEventListener('touchstart', this.onDown, true)
        window.removeEventListener('pointerup', this.onUp)
        window.removeEventListener('touchend', this.onUp)
        window.removeEventListener('touchcancel', this.onUp)
        if (this.releaseTimer != null) clearTimeout(this.releaseTimer)
      }

      private readonly onDown = (event: PointerEvent | TouchEvent): void => {
        if (event instanceof PointerEvent && event.button !== 0) return
        const target = event.target
        if (!(target instanceof Node) || !this.view.contentDOM.contains(target)) return
        if (target instanceof Element && target.closest('.cm-code-line, .cm-table-block')) return
        this.down = true
        if (this.releaseTimer != null) {
          clearTimeout(this.releaseTimer)
          this.releaseTimer = null
        }
        if (!this.view.state.field(previewFrozenField)) {
          this.view.dispatch({ effects: setPreviewFrozen.of(true) })
        }
      }

      private readonly onUp = (): void => {
        if (!this.down) return
        this.down = false
        if (this.releaseTimer != null) clearTimeout(this.releaseTimer)

        const release = (): void => {
          const effects = []
          if (this.view.state.field(previewFrozenField)) {
            effects.push(setPreviewFrozen.of(false))
          }
          if (this.view.hasFocus) {
            effects.push(editorFocusEffect.of(true))
          }
          if (effects.length > 0) {
            this.view.dispatch({ effects })
          }
        }

        const head = this.view.state.selection.main.head
        const inFenced = findFencedCodeBlockContaining(this.view.state.doc, head) != null
        const tailMs =
          !this.view.state.selection.main.empty && !inFenced
            ? SELECTION_FREEZE_TAIL_MS
            : FREEZE_TAIL_MS
        if (inFenced) {
          release()
          return
        }

        this.releaseTimer = setTimeout(() => {
          this.releaseTimer = null
          release()
        }, tailMs)
      }
    }
  )
}
