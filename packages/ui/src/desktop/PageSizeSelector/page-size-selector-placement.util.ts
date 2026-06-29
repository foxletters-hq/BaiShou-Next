export type DropdownPlacement = 'top' | 'bottom'

export const VIEWPORT_MARGIN = 8
export const DROPDOWN_GAP = 6
export const MIN_DROPDOWN_WIDTH = 160

export function estimateDropdownHeight(optionCount: number): number {
  const rows = Math.ceil(optionCount / 3)
  return 16 + rows * 38 + 13 + 24
}

export function resolveDropdownPlacement(
  triggerRect: Pick<DOMRect, 'top' | 'bottom'>,
  dropdownHeight: number,
  viewportHeight: number
): DropdownPlacement {
  const spaceAbove = triggerRect.top - VIEWPORT_MARGIN
  const spaceBelow = viewportHeight - triggerRect.bottom - VIEWPORT_MARGIN
  const required = dropdownHeight + DROPDOWN_GAP

  if (spaceBelow >= required) return 'bottom'
  if (spaceAbove >= required) return 'top'
  return spaceBelow >= spaceAbove ? 'bottom' : 'top'
}

export function resolveDropdownTop(
  triggerRect: Pick<DOMRect, 'top' | 'bottom'>,
  dropdownHeight: number,
  placement: DropdownPlacement,
  viewportHeight: number
): number {
  const rawTop =
    placement === 'bottom'
      ? triggerRect.bottom + DROPDOWN_GAP
      : triggerRect.top - dropdownHeight - DROPDOWN_GAP

  const maxTop = viewportHeight - dropdownHeight - VIEWPORT_MARGIN
  return Math.min(maxTop, Math.max(VIEWPORT_MARGIN, rawTop))
}

export function resolveDropdownLeft(
  triggerRect: Pick<DOMRect, 'left' | 'width'>,
  dropdownWidth: number,
  viewportWidth: number
): number {
  let left = triggerRect.left + triggerRect.width / 2 - dropdownWidth / 2
  const maxLeft = viewportWidth - dropdownWidth - VIEWPORT_MARGIN
  return Math.min(maxLeft, Math.max(VIEWPORT_MARGIN, left))
}
