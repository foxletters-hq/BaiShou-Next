import { applyFixedContextMenuLayout } from '../../../../desktop/ContextMenu/context-menu-placement.util'
import { DIARY_EDITOR_OVERLAY_Z } from '../../editorOverlayZIndex'

const TOOLTIP_SELECTOR = '.cm-tooltip.tbl-menu-tooltip'

function collectTableMenuTooltips(root: ParentNode): HTMLElement[] {
  const found = new Set<HTMLElement>()
  root.querySelectorAll(TOOLTIP_SELECTOR).forEach((node) => {
    if (node instanceof HTMLElement) found.add(node)
  })
  document.body.querySelectorAll(TOOLTIP_SELECTOR).forEach((node) => {
    if (node instanceof HTMLElement) found.add(node)
  })
  return [...found]
}

/** 将 ckant 行列菜单挂到 body 并避开底部 Markdown 工具栏 */
export function portalAndLayoutCkantTableMenu(tooltip: HTMLElement): void {
  const anchorRect = tooltip.getBoundingClientRect()
  if (anchorRect.width <= 0 && anchorRect.height <= 0) return

  const anchorX = anchorRect.left
  const anchorY = anchorRect.top

  if (tooltip.parentElement !== document.body) {
    document.body.appendChild(tooltip)
  }

  tooltip.style.position = 'fixed'
  tooltip.style.margin = '0'
  tooltip.style.right = 'auto'
  tooltip.style.bottom = 'auto'
  tooltip.style.transform = 'none'
  tooltip.style.translate = 'none'
  tooltip.style.zIndex = String(DIARY_EDITOR_OVERLAY_Z.tableMenu)
  tooltip.style.left = `${anchorX}px`
  tooltip.style.top = `${anchorY}px`

  applyFixedContextMenuLayout(tooltip, anchorX, anchorY)
}

export function applyCkantTableMenuPlacement(root: ParentNode): void {
  for (const tooltip of collectTableMenuTooltips(root)) {
    portalAndLayoutCkantTableMenu(tooltip)
  }
}
