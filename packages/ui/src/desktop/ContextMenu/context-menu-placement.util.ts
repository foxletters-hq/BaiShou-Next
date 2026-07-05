export const CONTEXT_MENU_MARGIN = 8
export const CONTEXT_MENU_GAP = 8

export const DESKTOP_INPUT_BAR_SELECTOR = '[data-desktop-input-bar]'
export const DIARY_MARKDOWN_TOOLBAR_SELECTOR = '[data-diary-markdown-toolbar]'

export const DEFAULT_BOTTOM_OBSTRUCTION_SELECTORS = [
  DESKTOP_INPUT_BAR_SELECTOR,
  DIARY_MARKDOWN_TOOLBAR_SELECTOR
] as const

export type ContextMenuBounds = {
  top: number
  left: number
  right: number
  bottom: number
}

export function getElementBottomInset(
  selector: string,
  viewportHeight: number = typeof window !== 'undefined' ? window.innerHeight : 0
): number {
  if (typeof document === 'undefined' || viewportHeight <= 0) return 0

  const el = document.querySelector(selector)
  if (!(el instanceof HTMLElement)) return 0

  const rect = el.getBoundingClientRect()
  if (rect.height <= 0 || rect.bottom <= rect.top) return 0

  const distanceFromBottom = viewportHeight - rect.top + CONTEXT_MENU_GAP
  return Math.max(0, Math.min(distanceFromBottom, viewportHeight))
}

/** @deprecated 使用 getElementBottomInset */
export function getComposerBottomInset(
  selector: string = DESKTOP_INPUT_BAR_SELECTOR,
  viewportHeight: number = typeof window !== 'undefined' ? window.innerHeight : 0
): number {
  return getElementBottomInset(selector, viewportHeight)
}

export function getOverlayBottomInset(
  selectors: readonly string[] = DEFAULT_BOTTOM_OBSTRUCTION_SELECTORS,
  viewportHeight: number = typeof window !== 'undefined' ? window.innerHeight : 0
): number {
  let maxInset = 0
  for (const selector of selectors) {
    maxInset = Math.max(maxInset, getElementBottomInset(selector, viewportHeight))
  }
  return maxInset
}

export function getDefaultContextMenuBounds(
  viewportWidth: number = typeof window !== 'undefined' ? window.innerWidth : 0,
  viewportHeight: number = typeof window !== 'undefined' ? window.innerHeight : 0,
  bottomInset: number = getOverlayBottomInset(DEFAULT_BOTTOM_OBSTRUCTION_SELECTORS, viewportHeight)
): ContextMenuBounds {
  const margin = CONTEXT_MENU_MARGIN
  const safeBottom = Math.max(margin, viewportHeight - bottomInset - margin)

  return {
    top: margin,
    left: margin,
    right: Math.max(margin, viewportWidth - margin),
    bottom: Math.max(margin, safeBottom)
  }
}

export function resolveContextMenuPosition(
  anchorX: number,
  anchorY: number,
  menuWidth: number,
  menuHeight: number,
  bounds: ContextMenuBounds
): { x: number; y: number } {
  const minX = bounds.left
  const maxX = Math.max(bounds.left, bounds.right - menuWidth)
  const minY = bounds.top
  const maxY = Math.max(bounds.top, bounds.bottom - menuHeight)

  let x = anchorX
  if (x + menuWidth > bounds.right) {
    x = bounds.right - menuWidth
  }
  x = Math.min(maxX, Math.max(minX, x))

  let y = anchorY
  if (y + menuHeight > bounds.bottom) {
    const aboveY = anchorY - menuHeight
    y = aboveY >= bounds.top ? aboveY : maxY
  }
  y = Math.min(maxY, Math.max(minY, y))

  return { x, y }
}

export function applyFixedContextMenuLayout(
  menuEl: HTMLElement,
  anchorX: number,
  anchorY: number,
  bounds: ContextMenuBounds = getDefaultContextMenuBounds()
): void {
  const rect = menuEl.getBoundingClientRect()
  const { x, y } = resolveContextMenuPosition(
    anchorX,
    anchorY,
    rect.width,
    rect.height,
    bounds
  )

  menuEl.style.left = `${x}px`
  menuEl.style.top = `${y}px`
}
