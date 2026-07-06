import type { EditorView } from '@codemirror/view'
import { isTableChromeTouchTarget } from './tableContextMenu'

const CHROME_TOUCH_SELECTOR = '.cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn'

/** 触摸端仅当 chrome 控件实际可点（非 pointer-events:none / 透明）时才拦截 */
export function isInteractableChromeElement(el: HTMLElement | null): boolean {
  if (!el) return false
  const chrome = el.matches(CHROME_TOUCH_SELECTOR)
    ? el
    : (el.closest(CHROME_TOUCH_SELECTOR) as HTMLElement | null)
  if (!chrome) return false

  const block = chrome.closest('.cm-table-block')
  if (block?.classList.contains('cm-table-block--touch')) {
    return (
      block.classList.contains('cm-table-block--has-active-cell') ||
      block.classList.contains('cm-table-block--col-selected') ||
      block.classList.contains('cm-table-block--row-selected')
    )
  }

  const style = window.getComputedStyle(chrome)
  if (style.pointerEvents === 'none') return false
  if (style.visibility === 'hidden' || style.display === 'none') return false

  const rect = chrome.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false

  const opacity = Number.parseFloat(style.opacity)
  if (Number.isFinite(opacity) && opacity < 0.05) return false

  return true
}

export function hitTestInteractableChromeAtPoint(
  view: EditorView,
  x: number,
  y: number
): HTMLElement | null {
  if (typeof document.elementFromPoint === 'function') {
    const hit = document.elementFromPoint(x, y)
    if (hit instanceof Element) {
      const fromPoint = isTableChromeTouchTarget(hit)
      if (fromPoint && isInteractableChromeElement(fromPoint)) return fromPoint
    }
  }

  for (const el of view.dom.querySelectorAll(CHROME_TOUCH_SELECTOR)) {
    const chrome = el as HTMLElement
    if (!isInteractableChromeElement(chrome)) continue
    const rect = chrome.getBoundingClientRect()
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return chrome
    }
  }
  return null
}
