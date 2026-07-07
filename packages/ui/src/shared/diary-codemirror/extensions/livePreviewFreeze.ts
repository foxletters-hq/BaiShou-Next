import { StateEffect, StateField } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'

const FREEZE_TAIL_MS = 100

export const setPreviewFrozen = StateEffect.define<boolean>()

export const previewFrozenField = StateField.define<boolean>({
  create: () => false,
  update(prev, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setPreviewFrozen)) return effect.value
    }
    return prev
  }
})

export const livePreviewFreezeMousePlugin = ViewPlugin.fromClass(
  class {
    private down = false
    private releaseTimer: number | null = null

    private readonly onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target
      if (!(target instanceof Node) || !this.view.contentDOM.contains(target)) return

      this.down = true
      if (this.releaseTimer != null) {
        window.clearTimeout(this.releaseTimer)
        this.releaseTimer = null
      }
      if (!this.view.state.field(previewFrozenField)) {
        this.view.dispatch({ effects: setPreviewFrozen.of(true) })
      }
    }

    private readonly onUp = () => {
      if (!this.down) return
      this.down = false
      if (this.releaseTimer != null) window.clearTimeout(this.releaseTimer)
      this.releaseTimer = window.setTimeout(() => {
        this.releaseTimer = null
        if (!this.view.state.field(previewFrozenField)) return
        try {
          this.view.dispatch({ effects: setPreviewFrozen.of(false) })
        } catch {
          /* view destroyed */
        }
      }, FREEZE_TAIL_MS)
    }

    constructor(readonly view: EditorView) {
      view.dom.addEventListener('pointerdown', this.onDown, true)
      window.addEventListener('pointerup', this.onUp)
      window.addEventListener('pointercancel', this.onUp)
    }

    update(_: ViewUpdate) {
      /* freeze driven by pointer events */
    }

    destroy() {
      this.view.dom.removeEventListener('pointerdown', this.onDown, true)
      window.removeEventListener('pointerup', this.onUp)
      window.removeEventListener('pointercancel', this.onUp)
      if (this.releaseTimer != null) window.clearTimeout(this.releaseTimer)
    }
  }
)

export function shouldSkipPreviewRebuildOnFrozen(update: ViewUpdate): boolean {
  const prevFrozen = update.startState.field(previewFrozenField)
  const nextFrozen = update.state.field(previewFrozenField)
  const justUnfroze = prevFrozen && !nextFrozen
  return nextFrozen && !justUnfroze && !update.docChanged
}
