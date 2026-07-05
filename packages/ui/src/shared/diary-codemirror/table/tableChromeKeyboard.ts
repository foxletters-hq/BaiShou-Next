declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void }
  }
}

import type { EditorView } from '@codemirror/view'
import { blurTableCellEditor } from './tableDom'

export function blurActiveTableCellInput(): void {
  blurTableCellEditor()
}

export function isActiveTableCellInput(element: Element | null): boolean {
  return element instanceof HTMLElement && element.matches('.cm-table-cell-source')
}

/** 点把手 / 菜单时收起输入法，避免菜单与键盘叠在一起 */
export function dismissEditorKeyboardForChrome(view: EditorView): void {
  blurActiveTableCellInput()
  const active = document.activeElement
  if (active instanceof HTMLElement) {
    active.blur()
  }
  view.contentDOM.blur()
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'dismissKeyboard' }))
  } catch {
    /* ignore */
  }
}

export function dismissNativeKeyboard(): void {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'dismissKeyboard' }))
  } catch {
    /* ignore */
  }
}
