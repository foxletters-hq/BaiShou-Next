export type WorkbenchCommentPopoverAnchor = {
  x?: number
  y?: number
}

/** 选区末尾下方留一点空隙，避免贴住最后一个字或鼠标。 */
const COMMENT_POPOVER_BELOW_GAP_PX = 16
const COMMENT_POPOVER_END_INSET_PX = 4

export function resolveWorkbenchCommentPopoverPosition(input: {
  x?: number
  y?: number
  windowWidth: number
  windowHeight: number
  popoverWidth?: number
  popoverHeight?: number
}): { x: number; y: number } {
  const popoverWidth = input.popoverWidth ?? 260
  const popoverHeight = input.popoverHeight ?? 180
  const rawX = Number.isFinite(input.x) ? Number(input.x) : 12
  const rawY = Number.isFinite(input.y) ? Number(input.y) : 12
  return {
    x: Math.min(Math.max(12, rawX), Math.max(12, input.windowWidth - popoverWidth - 12)),
    y: Math.min(Math.max(12, rawY), Math.max(12, input.windowHeight - popoverHeight - 12))
  }
}

export function commentPopoverAnchorFromSelectionCoords(
  coords: { left: number; right: number; top: number; bottom: number } | null | undefined
): WorkbenchCommentPopoverAnchor {
  if (!coords) return {}
  return {
    x: coords.right - COMMENT_POPOVER_END_INSET_PX,
    y: coords.bottom + COMMENT_POPOVER_BELOW_GAP_PX
  }
}
