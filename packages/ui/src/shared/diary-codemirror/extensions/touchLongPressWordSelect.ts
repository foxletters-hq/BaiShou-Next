import { Annotation, type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { logDiaryBridge } from '../diaryBridgeDebug'
import { shouldBlockEditorTouchForTableSheet } from '../table/tableSheetInteraction'
import {
  findWordRangeAtPosition,
  resolveTouchDocPosition,
  snapTouchSelectPos
} from './wordBoundaryAtPos'

const LONG_PRESS_MS = 420
const MOVE_CANCEL_PX = 12
/** 长按出词后，手指再移动超过此距离才进入「拖选扩展」（避免持按时微抖选中整段） */
const DRAG_EXTEND_PX = 20

export const touchLongPressWordSelectAnnotation = Annotation.define<boolean>()

function isWordSelectTarget(target: Element): boolean {
  if (!target.closest('.cm-content')) return false
  if (
    target.closest(
      '.cm-table-block, .cm-table-cell-source, .cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn'
    )
  ) {
    return false
  }
  return true
}

class TouchLongPressWordSelect {
  private pressTimer: ReturnType<typeof setTimeout> | null = null
  private startX = 0
  private startY = 0
  private cachedDocPos: number | null = null
  private fingerDown = false
  private dragAnchor: number | null = null
  private wordSelected = false
  private dragExtendActive = false
  private selectAtX = 0
  private selectAtY = 0

  constructor(private readonly view: EditorView) {}

  destroy(): void {
    this.clearPress()
  }

  private clearPress(): void {
    if (this.pressTimer != null) {
      clearTimeout(this.pressTimer)
      this.pressTimer = null
    }
  }

  private resetDragState(): void {
    this.dragAnchor = null
    this.wordSelected = false
    this.dragExtendActive = false
  }

  private clearDomSelection(): void {
    try {
      const sel = document.getSelection()
      if (sel && !sel.isCollapsed) sel.removeAllRanges()
    } catch {
      /* ignore */
    }
  }

  private dispatchSelection(anchor: number, head: number): void {
    this.view.dispatch({
      selection: { anchor, head },
      scrollIntoView: false,
      annotations: touchLongPressWordSelectAnnotation.of(true)
    })
  }

  selectWordAtCachedPos(clientX: number, clientY: number): void {
    const pos = this.cachedDocPos
    if (pos == null) return

    const doc = this.view.state.doc.toString()
    const snappedPos = snapTouchSelectPos(doc, pos)
    const range = findWordRangeAtPosition(doc, pos)
    if (range.from >= range.to) return

    const text = this.view.state.sliceDoc(range.from, range.to)

    try {
      navigator.vibrate?.(10)
    } catch {
      /* ignore */
    }

    this.clearDomSelection()
    this.dragAnchor = range.from
    this.wordSelected = true
    this.dragExtendActive = false
    this.selectAtX = clientX
    this.selectAtY = clientY
    this.dispatchSelection(range.from, range.to)
    this.view.focus()

    logDiaryBridge('selectDbg', 'long-press-word', {
      touchPos: pos,
      snappedPos,
      from: range.from,
      to: range.to,
      text,
      clientX,
      clientY
    })
  }

  onTouchStart(event: TouchEvent): boolean {
    if (shouldBlockEditorTouchForTableSheet()) return false

    const touch = event.touches[0]
    if (!touch) return false
    const target = event.target
    if (!(target instanceof Element) || !isWordSelectTarget(target)) {
      return false
    }

    this.resetDragState()
    this.fingerDown = true
    this.startX = touch.clientX
    this.startY = touch.clientY
    this.cachedDocPos = resolveTouchDocPosition(this.view, touch.clientX, touch.clientY)
    this.clearPress()
    this.clearDomSelection()

    this.pressTimer = setTimeout(() => {
      this.pressTimer = null
      if (!this.fingerDown) return
      const t = event.touches[0]
      if (!t) return
      this.selectWordAtCachedPos(t.clientX, t.clientY)
    }, LONG_PRESS_MS)

    return false
  }

  onTouchMove(event: TouchEvent): boolean {
    const touch = event.touches[0]
    if (!touch) return false

    if (this.wordSelected && this.fingerDown && this.dragAnchor != null) {
      const movedFromSelect = Math.hypot(
        touch.clientX - this.selectAtX,
        touch.clientY - this.selectAtY
      )
      if (!this.dragExtendActive) {
        if (movedFromSelect < DRAG_EXTEND_PX) return false
        this.dragExtendActive = true
      }

      const pos = resolveTouchDocPosition(this.view, touch.clientX, touch.clientY)
      if (pos != null) {
        this.dispatchSelection(this.dragAnchor, pos)
      }
      event.preventDefault()
      return true
    }

    if (!this.pressTimer) return false
    if (Math.hypot(touch.clientX - this.startX, touch.clientY - this.startY) >= MOVE_CANCEL_PX) {
      this.clearPress()
    }
    return false
  }

  onTouchEnd(): boolean {
    this.fingerDown = false
    this.clearPress()
    this.wordSelected = false
    this.dragExtendActive = false
    this.dragAnchor = null
    return false
  }
}

const touchLongPressWordSelectViewPlugin = ViewPlugin.fromClass(TouchLongPressWordSelect, {
  eventHandlers: {
    touchstart(event, view) {
      return view.plugin(touchLongPressWordSelectViewPlugin)?.onTouchStart(event) ?? false
    },
    touchmove(event, view) {
      return view.plugin(touchLongPressWordSelectViewPlugin)?.onTouchMove(event) ?? false
    },
    touchend(_event, view) {
      return view.plugin(touchLongPressWordSelectViewPlugin)?.onTouchEnd() ?? false
    },
    touchcancel(_event, view) {
      return view.plugin(touchLongPressWordSelectViewPlugin)?.onTouchEnd() ?? false
    }
  }
})

/** 触摸长按选词；明显滑动后再扩展选区（仿系统拖选，非拖移文本） */
export function touchLongPressWordSelectPlugin(): Extension {
  return touchLongPressWordSelectViewPlugin
}
