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

/** 锚点落在输入框内时，不再把输入框当作底部遮挡（避免菜单被顶到很靠上） */
export function getContextMenuBoundsForAnchor(
  anchorEl?: Element | null,
  viewportWidth: number = typeof window !== 'undefined' ? window.innerWidth : 0,
  viewportHeight: number = typeof window !== 'undefined' ? window.innerHeight : 0
): ContextMenuBounds {
  const obstructSelectors =
    anchorEl?.closest(DESKTOP_INPUT_BAR_SELECTOR) != null
      ? DEFAULT_BOTTOM_OBSTRUCTION_SELECTORS.filter((s) => s !== DESKTOP_INPUT_BAR_SELECTOR)
      : DEFAULT_BOTTOM_OBSTRUCTION_SELECTORS
  const bottomInset = getOverlayBottomInset(obstructSelectors, viewportHeight)
  return getDefaultContextMenuBounds(viewportWidth, viewportHeight, bottomInset)
}

export type ResolveContextMenuPositionOptions = {
  /**
   * 将 anchorY 视为菜单底边目标（紧贴锚点上方）。
   * 用于输入框加号等需要向上展开、避免盖住输入区的场景。
   */
  preferAbove?: boolean
}

export function resolveContextMenuPosition(
  anchorX: number,
  anchorY: number,
  menuWidth: number,
  menuHeight: number,
  bounds: ContextMenuBounds,
  options?: ResolveContextMenuPositionOptions
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
  if (options?.preferAbove) {
    // anchorY = 期望的菜单底边；优先整块放在上方
    const aboveTop = anchorY - menuHeight
    if (aboveTop >= bounds.top) {
      y = aboveTop
    } else {
      // 上方不够时退到下方，从 anchorY + gap 起算
      const belowTop = anchorY + CONTEXT_MENU_GAP
      y = belowTop + menuHeight <= bounds.bottom ? belowTop : maxY
    }
  } else if (y + menuHeight > bounds.bottom) {
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
  bounds: ContextMenuBounds = getDefaultContextMenuBounds(),
  options?: ResolveContextMenuPositionOptions
): void {
  const rect = menuEl.getBoundingClientRect()
  const { x, y } = resolveContextMenuPosition(
    anchorX,
    anchorY,
    rect.width,
    rect.height,
    bounds,
    options
  )

  menuEl.style.left = `${x}px`
  menuEl.style.top = `${y}px`
}
