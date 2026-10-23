import { sharedTokens } from '../../theme/tokens'

/** 与 ContextMenu 外壳 minWidth 一致，用来把菜单右缘对齐触发器后再内收 gap */
export const ANCHORED_MENU_MIN_WIDTH = 96

/** 与桌面 CONTEXT_MENU_GAP 同一档，避免菜单贴住开启按钮 */
export const ANCHORED_MENU_GAP = sharedTokens.spacing.sm

export type AnchoredMenuPlacement = 'below' | 'side'

export function computeAnchoredMenuPosition(input: {
  triggerX: number
  triggerY: number
  triggerWidth: number
  triggerHeight: number
  windowWidth: number
  windowHeight: number
  menuWidth?: number
  menuHeight?: number
  margin?: number
  placement?: AnchoredMenuPlacement
  /** Android 上 Modal 常比 measureInWindow 多出状态栏高度，调用方把差值传进来 */
  triggerYOffset?: number
}): { left: number; top: number } {
  const menuWidth = input.menuWidth ?? ANCHORED_MENU_MIN_WIDTH
  const margin = input.margin ?? sharedTokens.spacing.sm
  const menuHeight = input.menuHeight ?? 0
  const gap = ANCHORED_MENU_GAP
  const triggerY = input.triggerY + (input.triggerYOffset ?? 0)
  const placement = input.placement ?? 'below'

  if (placement === 'side') {
    return placeBesideTrigger({
      triggerX: input.triggerX,
      triggerY,
      triggerWidth: input.triggerWidth,
      menuWidth,
      menuHeight,
      windowWidth: input.windowWidth,
      windowHeight: input.windowHeight,
      margin,
      gap
    })
  }

  let left = input.triggerX + input.triggerWidth - menuWidth - gap
  left = Math.max(margin, Math.min(left, input.windowWidth - menuWidth - margin))

  let top = triggerY + input.triggerHeight + gap
  if (menuHeight > 0 && top + menuHeight > input.windowHeight - margin) {
    top = Math.max(margin, triggerY - menuHeight - gap)
  }

  return { left, top }
}

function placeBesideTrigger(input: {
  triggerX: number
  triggerY: number
  triggerWidth: number
  menuWidth: number
  menuHeight: number
  windowWidth: number
  windowHeight: number
  margin: number
  gap: number
}): { left: number; top: number } {
  const {
    triggerX,
    triggerY,
    triggerWidth,
    menuWidth,
    menuHeight,
    windowWidth,
    windowHeight,
    margin,
    gap
  } = input
  const leftCandidate = triggerX - menuWidth - gap
  const rightCandidate = triggerX + triggerWidth + gap
  const fitsLeft = leftCandidate >= margin
  const fitsRight = rightCandidate + menuWidth <= windowWidth - margin

  let left = leftCandidate
  if (!fitsLeft && fitsRight) {
    left = rightCandidate
  } else if (!fitsLeft && !fitsRight) {
    left = Math.max(margin, Math.min(leftCandidate, windowWidth - menuWidth - margin))
  }

  let top = triggerY
  if (menuHeight > 0 && top + menuHeight > windowHeight - margin) {
    top = Math.max(margin, windowHeight - menuHeight - margin)
  } else {
    top = Math.max(margin, top)
  }

  return { left, top }
}
