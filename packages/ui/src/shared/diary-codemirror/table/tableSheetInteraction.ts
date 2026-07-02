import { EditorView } from '@codemirror/view'
import { setActiveTableCell } from './tableActiveCell'
import {
  blurActiveTableCellInput,
  dismissEditorKeyboardForChrome,
  dismissNativeKeyboard
} from './tableChromeKeyboard'

import { isNativeTableSheetOpen } from './tableNativeSheet'

const MENU_LAYER_SELECTOR = '.cm-table-sheet-layer'

let touchShieldUntil = 0
let touchShieldInstalled = false

export function isTableSheetOpen(): boolean {
  return isNativeTableSheetOpen() || Boolean(document.querySelector(MENU_LAYER_SELECTOR))
}

export function resolveEditorViewFromDom(): EditorView | null {
  const el = document.querySelector('.cm-editor')
  if (!el) return null
  return EditorView.findFromDOM(el) ?? null
}

/** 收起输入法并退出表格单元格编辑态 */
export function dismissKeyboardForSheetInteraction(): void {
  const view = resolveEditorViewFromDom()
  if (view) {
    view.dispatch({ effects: setActiveTableCell.of(null) })
    dismissEditorKeyboardForChrome(view)
    return
  }
  dismissNativeKeyboard()
}

/** 菜单关闭后短暂吸收触摸，避免 touchend 落到正文唤起键盘 */
export function armTableSheetTouchShield(ms = 420): void {
  touchShieldUntil = Date.now() + ms
  installTableSheetTouchShield()
}

function shouldShieldTableTouch(): boolean {
  return isTableSheetOpen() || Date.now() < touchShieldUntil
}

function installTableSheetTouchShield(): void {
  if (touchShieldInstalled) return
  touchShieldInstalled = true

  const absorb = (event: TouchEvent) => {
    const target = event.target
    if (target instanceof Element && target.closest('.cm-table-sheet-layer')) {
      return
    }
    if (!shouldShieldTableTouch()) return
    event.preventDefault()
    event.stopPropagation()
    dismissKeyboardForSheetInteraction()
  }

  document.addEventListener('touchend', absorb, { capture: true, passive: false })
}

export function markTableSheetOpen(): void {
  installTableSheetTouchShield()
  document.documentElement.classList.add('cm-table-sheet-open')
  dismissKeyboardForSheetInteraction()
}

export function markTableSheetClosed(): void {
  document.documentElement.classList.remove('cm-table-sheet-open')
  armTableSheetTouchShield()
  dismissKeyboardForSheetInteraction()
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void }
  }
}