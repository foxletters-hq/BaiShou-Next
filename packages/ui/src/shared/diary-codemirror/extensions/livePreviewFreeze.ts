import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'

const FREEZE_TAIL_MS = 100

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
        window.addEventListener('pointerup', this.onUp)
      }

      destroy(): void {
        this.view.contentDOM.removeEventListener('pointerdown', this.onDown, true)
        window.removeEventListener('pointerup', this.onUp)
        if (this.releaseTimer != null) clearTimeout(this.releaseTimer)
      }

      private readonly onDown = (event: PointerEvent): void => {
        if (event.button !== 0) return
        const target = event.target
        if (!(target instanceof Node) || !this.view.contentDOM.contains(target)) return
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
        this.releaseTimer = setTimeout(() => {
          this.releaseTimer = null
          if (this.view.state.field(previewFrozenField)) {
            this.view.dispatch({ effects: setPreviewFrozen.of(false) })
          }
        }, FREEZE_TAIL_MS)
      }
    }
  )
}
