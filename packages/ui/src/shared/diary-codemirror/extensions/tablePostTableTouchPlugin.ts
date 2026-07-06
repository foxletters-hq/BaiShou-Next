import { type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { isTableChromeTouchTarget } from '../table/tableContextMenu'
import { isInteractableChromeElement } from '../table/tableChromeHitTest'
import { logDiaryBridge } from '../diaryBridgeDebug'
import { logTouchSelectionProbe } from './touchSelectionDebug'
import { logTableDesktop } from '../table/tableDesktopDebug'
import { shouldBlockEditorTouchForTableSheet } from '../table/tableSheetInteraction'
import { clearTableChromeSelection } from '../table/tableChromeSelection'
import { activeTableCellField, setActiveTableCell } from '../table/tableActiveCell'
import {
  placeEditorCaretFromPointer
} from '../table/tableEditorTouchCaret'
import {
  hasEditorDomTextSelection,
  isChromeTouchBlocked as isChromeTouchBlockedPolicy,
  shouldExplicitCaretPlacement,
  shouldPlaceCaretOnTapEnd
} from './tablePostTableTouchPolicy'
import type { DiaryCmPlatform } from '../types'

const TAP_MOVE_THRESHOLD_PX = 10
const CLICK_SUPPRESS_MS = 400
/** 超过此时长的触摸视为长按选词，不在 touchend 强行落光标 */
const LONG_PRESS_GUARD_MS = 480

interface TouchCaretState {
  touchStart: { x: number; y: number; at: number } | null
  suppressClickUntil: number
  placedOnTouchStart: boolean
}

const touchCaretStateByView = new WeakMap<EditorView, TouchCaretState>()

function getTouchCaretState(view: EditorView): TouchCaretState {
  let state = touchCaretStateByView.get(view)
  if (!state) {
    state = { touchStart: null, suppressClickUntil: 0, placedOnTouchStart: false }
    touchCaretStateByView.set(view, state)
  }
  return state
}

function noteTouchStart(view: EditorView, event: TouchEvent): void {
  const touch = event.touches[0]
  const state = getTouchCaretState(view)
  state.placedOnTouchStart = false
  if (!touch) {
    state.touchStart = null
    return
  }
  state.touchStart = { x: touch.clientX, y: touch.clientY, at: Date.now() }
}

function touchDurationMs(view: EditorView): number {
  const startedAt = getTouchCaretState(view).touchStart?.at
  if (startedAt == null) return 0
  return Date.now() - startedAt
}

function isLongPressGesture(view: EditorView): boolean {
  return touchDurationMs(view) >= LONG_PRESS_GUARD_MS
}

function isChromeTouchBlocked(target: Element): boolean {
  return isChromeTouchBlockedPolicy(
    target,
    isTableChromeTouchTarget,
    isInteractableChromeElement
  )
}

function shouldSkipTapCaretPlacement(view: EditorView): boolean {
  if (!view.state.selection.main.empty) return true
  if (hasEditorDomTextSelection(view)) return true
  return false
}

function shouldPlaceCaretOnTouchStart(
  view: EditorView,
  target: Element,
  _clientX: number,
  clientY: number
): boolean {
  if (isChromeTouchBlocked(target)) return false
  return shouldExplicitCaretPlacement(view, target, clientY)
}

function touchMoved(view: EditorView, event: TouchEvent): boolean {
  const state = getTouchCaretState(view)
  const end = event.changedTouches[0]
  if (!end || !state.touchStart) return false
  return (
    Math.hypot(end.clientX - state.touchStart.x, end.clientY - state.touchStart.y) >=
    TAP_MOVE_THRESHOLD_PX
  )
}

function placeCaretAndClearTableChrome(
  view: EditorView,
  clientX: number,
  clientY: number,
  reason: string,
  target?: Element | null
): boolean {
  const placed = placeEditorCaretFromPointer(view, clientX, clientY, reason, target)
  if (!placed) return false
  clearTableChromeSelection(view)
  const active = view.state.field(activeTableCellField, false)
  if (active) {
    view.dispatch({ effects: setActiveTableCell.of(null) })
  }
  return true
}

/**
 * 触摸/桌面：在表后正文区或表格 widget 下半部点击时，显式把 CM 选区落到坐标处。
 */
export function tablePostTableTouchPlugin(platform?: DiaryCmPlatform): Extension {
  const mode = platform?.interactionMode
  if (mode !== 'touch' && mode !== 'mouse') return []

  const isTouch = mode === 'touch'

  return ViewPlugin.fromClass(
    class {
      constructor(private readonly view: EditorView) {}

      destroy() {
        touchCaretStateByView.delete(this.view)
      }
    },
    {
      eventHandlers: {
        touchstart(event, view) {
          noteTouchStart(view, event)
          if (shouldBlockEditorTouchForTableSheet()) return false

          const touch = event.touches[0]
          if (!touch) return false
          const target = event.target
          if (!(target instanceof Element)) return false
          const should = shouldPlaceCaretOnTouchStart(view, target, touch.clientX, touch.clientY)
          logDiaryBridge('tableTouch', 'touchstart', {
            shouldPlace: should,
            targetClass: target.className?.slice?.(0, 40) ?? '',
            head: view.state.selection.main.head,
            docLen: view.state.doc.length
          })
          if (!should) return false

          const state = getTouchCaretState(view)
          state.placedOnTouchStart = placeCaretAndClearTableChrome(
            view,
            touch.clientX,
            touch.clientY,
            'touchstart',
            target
          )
          logDiaryBridge('tableTouch', 'touchstart:after-place', {
            placed: state.placedOnTouchStart,
            head: view.state.selection.main.head,
            docLen: view.state.doc.length,
            clientX: touch.clientX,
            clientY: touch.clientY
          })
          return false
        },
        touchend(event, view) {
          const touch = event.changedTouches[0]
          const touchMeta = touch
            ? {
                clientX: touch.clientX,
                clientY: touch.clientY,
                durationMs: touchDurationMs(view)
              }
            : undefined

          if (shouldBlockEditorTouchForTableSheet()) return false
          if (touchMoved(view, event)) {
            if (touchMeta) {
              logTouchSelectionProbe(view, 'touchend-skip:moved', touchMeta)
            }
            return false
          }

          const state = getTouchCaretState(view)
          if (state.placedOnTouchStart) {
            state.placedOnTouchStart = false
            state.suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS
            if (touchMeta) {
              logTouchSelectionProbe(view, 'touchend-skip:placed-on-touchstart', touchMeta)
            }
            return false
          }

          if (isLongPressGesture(view)) {
            if (touchMeta) {
              logTouchSelectionProbe(view, 'touchend-skip:long-press', touchMeta)
            }
            return false
          }

          if (shouldSkipTapCaretPlacement(view)) {
            if (touchMeta) {
              logTouchSelectionProbe(view, 'touchend-skip:has-selection', touchMeta)
            }
            return false
          }

          if (!touch) return false
          const target = event.target
          if (!(target instanceof Element)) return false
          if (
            !shouldPlaceCaretOnTapEnd(view, target, touch.clientY, isTouch) ||
            isChromeTouchBlocked(target)
          ) {
            if (touchMeta) {
              logTouchSelectionProbe(view, 'touchend-skip:not-tap-target', touchMeta)
            }
            return false
          }

          if (touchMeta) {
            logTouchSelectionProbe(view, 'touchend-will-place-caret', touchMeta)
          }
          placeCaretAndClearTableChrome(view, touch.clientX, touch.clientY, 'touchend', target)
          state.suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS
          return false
        },
        click(event, view) {
          if (isTouch && Date.now() < getTouchCaretState(view).suppressClickUntil) {
            return false
          }
          if (shouldSkipTapCaretPlacement(view)) {
            return false
          }
          const target = event.target
          if (!(target instanceof Element)) return false
          if (
            !shouldPlaceCaretOnTapEnd(view, target, event.clientY, isTouch) ||
            isChromeTouchBlocked(target)
          ) {
            return false
          }

          logTableDesktop('post-table:click', {
            x: event.clientX,
            y: event.clientY,
            head: view.state.selection.main.head
          })
          placeCaretAndClearTableChrome(view, event.clientX, event.clientY, 'click', target)
          return false
        },
        pointerdown(event, view) {
          if (isTouch || event.button !== 0) return false
          if (shouldBlockEditorTouchForTableSheet()) return false
          const target = event.target
          if (!(target instanceof Element)) return false
          // 表格 widget 内点击全部由 TableBlockWidget 处理
          if (target.closest('.cm-table-block')) return false
          if (
            !shouldPlaceCaretOnTapEnd(view, target, event.clientY, false) ||
            isChromeTouchBlocked(target)
          ) {
            return false
          }
          logTableDesktop('post-table:pointerdown', {
            x: event.clientX,
            y: event.clientY,
            className: target.className?.slice(0, 50) ?? '',
            head: view.state.selection.main.head
          })
          placeCaretAndClearTableChrome(view, event.clientX, event.clientY, 'pointerdown', target)
          return false
        }
      }
    }
  )
}
