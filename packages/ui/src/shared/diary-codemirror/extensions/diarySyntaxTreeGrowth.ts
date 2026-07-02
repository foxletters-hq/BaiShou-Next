import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { StateEffect } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'

/** 语法树增量解析推进后通知装饰层重建（大文档中表格/图片块延迟渲染） */
export const diarySyntaxTreeGrowthEffect = StateEffect.define<null>()

const GROWTH_THRESHOLD = 8192
const TICK_BUDGET_MS = 30

type IdleHandle = { kind: 'idle'; id: number } | { kind: 'raf'; id: number }

function scheduleIdle(cb: () => void): IdleHandle {
  if (typeof window.requestIdleCallback === 'function') {
    return { kind: 'idle', id: window.requestIdleCallback(() => cb()) }
  }
  return { kind: 'raf', id: window.requestAnimationFrame(() => cb()) }
}

function cancelIdle(handle: IdleHandle): void {
  if (handle.kind === 'idle' && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle.id)
  } else if (handle.kind === 'raf') {
    window.cancelAnimationFrame(handle.id)
  }
}

export const diarySyntaxTreeGrowthPlugin = ViewPlugin.fromClass(
  class {
    private lastTreeLen: number
    private idleHandle: IdleHandle | null = null
    private destroyed = false

    constructor(private readonly view: EditorView) {
      this.lastTreeLen = syntaxTree(view.state).length
      this.schedule()
    }

    update(update: { docChanged: boolean; state: typeof this.view.state }) {
      if (update.docChanged) {
        this.lastTreeLen = syntaxTree(update.state).length
        this.schedule()
      }
    }

    destroy() {
      this.destroyed = true
      if (this.idleHandle !== null) {
        cancelIdle(this.idleHandle)
        this.idleHandle = null
      }
    }

    private schedule() {
      if (this.idleHandle !== null) return
      this.idleHandle = scheduleIdle(() => {
        this.idleHandle = null
        if (!this.destroyed) this.tick()
      })
    }

    private tick() {
      const state = this.view.state
      const docLen = state.doc.length
      if (this.lastTreeLen >= docLen) return

      const ensured = ensureSyntaxTree(state, docLen, TICK_BUDGET_MS)
      const newLen = (ensured ?? syntaxTree(state)).length

      if (newLen >= this.lastTreeLen + GROWTH_THRESHOLD || newLen >= docLen) {
        const previous = this.lastTreeLen
        this.lastTreeLen = newLen
        try {
          this.view.dispatch({ effects: diarySyntaxTreeGrowthEffect.of(null) })
        } catch {
          this.lastTreeLen = previous
          return
        }
      }

      if (newLen < docLen) this.schedule()
    }
  }
)
