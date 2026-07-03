import { type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { isTableChromeTouchTarget } from '../table/tableContextMenu'
import { isInteractableChromeElement } from '../table/tableChromeHitTest'
import { logDiaryBridge } from '../diaryBridgeDebug'
import { isTableSheetOpen } from '../table/tableSheetInteraction'
import { clearTableChromeSelection } from '../table/tableChromeSelection'
import { activeTableCellField, setActiveTableCell } from '../table/tableActiveCell'
import {
  findTableBlockAbovePoint,
  placeEditorCaretFromPointer
} from '../table/tableEditorTouchCaret'
import type { DiaryCmPlatform } from '../types'

const TAP_MOVE_THRESHOLD_PX = 10
const CLICK_SUPPRESS_MS = 400

interface TouchCaretState {
  touchStart: { x: number; y: number } | null
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
  state.touchStart = { x: touch.clientX, y: touch.clientY }
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

function shouldPlaceCaretFromTouch(
  view: EditorView,
  target: Element,
  clientX: number,
  clientY: number
): boolean {
  if (target.closest('.cm-table-context-menu-layer, .cm-table-sheet-layer')) return false
  if (target.closest('.cm-table-cell-source')) return false
  if (
    target.closest('.cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn')
  ) {
    return false
  }

  const chrome = isTableChromeTouchTarget(target)
  if (chrome && isInteractableChromeElement(chrome)) return false

  if (target.closest('.cm-content')) return true
  if (target.closest('.cm-table-block')) {
    return findTableBlockAbovePoint(view, clientY) != null
  }
  return findTableBlockAbovePoint(view, clientY) != null
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
 * 触摸端：在表后正文区点击时，显式把 CM 选区落到坐标处。
 * 块级表格 widget 下方 Android WebView 往往无法自动更新选区，导致 head 卡在 0、无法输入。
 */
export function tablePostTableTouchPlugin(platform?: DiaryCmPlatform): Extension {
  if (platform?.interactionMode !== 'touch') return []

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
          if (isTableSheetOpen()) return false

          const touch = event.touches[0]
          if (!touch) return false
          const target = event.target
          if (!(target instanceof Element)) return false
          const should = shouldPlaceCaretFromTouch(view, target, touch.clientX, touch.clientY)
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
          return false
        },
        touchend(event, view) {
          if (isTableSheetOpen()) return false
          if (touchMoved(view, event)) return false

          const state = getTouchCaretState(view)
          if (state.placedOnTouchStart) {
            state.placedOnTouchStart = false
            state.suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS
            return false
          }

          const touch = event.changedTouches[0]
          if (!touch) return false
          const target = event.target
          if (!(target instanceof Element)) return false
          if (
            !shouldPlaceCaretFromTouch(view, target, touch.clientX, touch.clientY)
          ) {
            return false
          }

          placeCaretAndClearTableChrome(
            view,
            touch.clientX,
            touch.clientY,
            'touchend',
            target
          )
          state.suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS
          return false
        },
        click(event, view) {
          if (isTableSheetOpen()) return false
          if (Date.now() < getTouchCaretState(view).suppressClickUntil) {
            return false
          }
          const target = event.target
          if (!(target instanceof Element)) return false
          if (
            !shouldPlaceCaretFromTouch(view, target, event.clientX, event.clientY)
          ) {
            return false
          }

          placeCaretAndClearTableChrome(
            view,
            event.clientX,
            event.clientY,
            'click',
            target
          )
          return false
        }
      }
    }
  )
}
