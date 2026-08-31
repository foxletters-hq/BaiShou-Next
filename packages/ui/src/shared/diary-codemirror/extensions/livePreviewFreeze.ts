import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { editorFocusEffect } from './editorFocus'
import { findFencedCodeBlockContaining } from './fencedCodeScan'

const FREEZE_TAIL_MS = 100
/** 选区未折叠时延长冻结，避免 touchend 后立刻重建装饰导致高亮跳变 */
const SELECTION_FREEZE_TAIL_MS = 320

export const setPreviewFrozen = StateEffect.define<boolean>()

/** 松手后再强制重建装饰；按下期间只改内存标记，避免 dispatch 打断点击定位 */
export const livePreviewRefreshEffect = StateEffect.define<null>()

export const previewFrozenField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setPreviewFrozen)) return effect.value
    }
    return value
  }
})

export interface LivePreviewPointerGate {
  frozen: boolean
}

const pointerGates = new WeakMap<EditorView, LivePreviewPointerGate>()

export function isLivePreviewPointerFrozen(view: EditorView): boolean {
  return (
    pointerGates.get(view)?.frozen === true || view.state.field(previewFrozenField, false) === true
  )
}

/** 指针按下期间冻结 live preview 装饰重建，避免点击时围栏/标题语法显隐导致布局抖动 */
export function livePreviewFreezePlugin(pointerGate: LivePreviewPointerGate): Extension {
  return ViewPlugin.fromClass(
    class {
      private down = false
      private releaseTimer: ReturnType<typeof setTimeout> | null = null

      constructor(private readonly view: EditorView) {
        pointerGates.set(view, pointerGate)
        this.view.dom.addEventListener('pointerdown', this.onDown, true)
        this.view.contentDOM.addEventListener('touchstart', this.onDown, {
          capture: true,
          passive: true
        })
        window.addEventListener('pointerup', this.onUp)
        window.addEventListener('pointercancel', this.onUp)
        window.addEventListener('touchend', this.onUp, { passive: true })
        window.addEventListener('touchcancel', this.onUp, { passive: true })
      }

      destroy(): void {
        pointerGates.delete(this.view)
        this.view.dom.removeEventListener('pointerdown', this.onDown, true)
        this.view.contentDOM.removeEventListener('touchstart', this.onDown, true)
        window.removeEventListener('pointerup', this.onUp)
        window.removeEventListener('pointercancel', this.onUp)
        window.removeEventListener('touchend', this.onUp)
        window.removeEventListener('touchcancel', this.onUp)
        if (this.releaseTimer != null) clearTimeout(this.releaseTimer)
      }

      private readonly onDown = (event: PointerEvent | TouchEvent): void => {
        if (event instanceof PointerEvent && event.button !== 0) return
        const target = event.target
        if (!(target instanceof Node) || !this.view.dom.contains(target)) return
        if (target instanceof Element && target.closest('.cm-table-block')) return
        this.down = true
        pointerGate.frozen = true
        if (this.releaseTimer != null) {
          clearTimeout(this.releaseTimer)
          this.releaseTimer = null
        }
      }

      private readonly onUp = (): void => {
        if (!this.down) return
        this.down = false
        if (this.releaseTimer != null) clearTimeout(this.releaseTimer)

        const release = (): void => {
          pointerGate.frozen = false
          const effects = [livePreviewRefreshEffect.of(null)]
          if (this.view.state.field(previewFrozenField)) {
            effects.push(setPreviewFrozen.of(false))
          }
          if (this.view.hasFocus) {
            effects.push(editorFocusEffect.of(true))
          }
          this.view.dispatch({ effects })
        }

        const head = this.view.state.selection.main.head
        const inFenced = findFencedCodeBlockContaining(this.view.state.doc, head) != null
        // 围栏内也等到当前指针事件结束再解冻，避免 mouseup 前重建装饰把坐标推到文末
        const tailMs = inFenced
          ? 0
          : !this.view.state.selection.main.empty
            ? SELECTION_FREEZE_TAIL_MS
            : FREEZE_TAIL_MS

        this.releaseTimer = setTimeout(() => {
          this.releaseTimer = null
          release()
        }, tailMs)
      }
    }
  )
}
