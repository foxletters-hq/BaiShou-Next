import { EditorView } from '@codemirror/view'
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
  if (!(el instanceof HTMLElement)) return null
  return EditorView.findFromDOM(el) ?? null
}

/** 收起输入法；保留 activeCell / chromeSelection，便于面板关闭后把手仍可见 */
export function dismissKeyboardForSheetInteraction(): void {
  const view = resolveEditorViewFromDom()
  if (view) {
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

  document.addEventListener('touchstart', absorb, { capture: true, passive: false })
  document.addEventListener('touchend', absorb, { capture: true, passive: false })
}

export function shouldBlockEditorTouchForTableSheet(): boolean {
  return shouldShieldTableTouch()
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

/** 仅测试：清除跨用例残留的 sheet 触摸屏蔽状态 */
export function resetTableSheetInteractionForTests(): void {
  touchShieldUntil = 0
  document.documentElement.classList.remove('cm-table-sheet-open')
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void }
  }
}
