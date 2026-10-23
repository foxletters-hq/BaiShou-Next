export const SELECT_DROPDOWN_GAP = 4
export const SELECT_DROPDOWN_MARGIN = 8
export const SELECT_DROPDOWN_MAX_HEIGHT = 240

export function estimateSelectDropdownHeight(optionCount: number): number {
  return Math.min(SELECT_DROPDOWN_MAX_HEIGHT, optionCount * 36 + 8)
}

export function resolveSelectDropdownBox(
  trigger: { top: number; bottom: number; left: number; width: number },
  dropdownHeight: number,
  viewport: { width: number; height: number },
  opts?: { minWidth?: number }
): { top: number; left: number; width: number; maxHeight: number } {
  const minWidth = opts?.minWidth ?? trigger.width
  const width = Math.min(
    Math.max(viewport.width - SELECT_DROPDOWN_MARGIN * 2, 0),
    Math.max(trigger.width, minWidth)
  )
  const maxHeight = Math.min(
    SELECT_DROPDOWN_MAX_HEIGHT,
    Math.max(0, viewport.height - SELECT_DROPDOWN_MARGIN * 2)
  )
  const height = Math.min(Math.max(dropdownHeight, 1), maxHeight || 1)
  const spaceBelow = viewport.height - trigger.bottom - SELECT_DROPDOWN_MARGIN
  const spaceAbove = trigger.top - SELECT_DROPDOWN_MARGIN
  const openUp = spaceBelow < height + SELECT_DROPDOWN_GAP && spaceAbove > spaceBelow
  const rawTop = openUp
    ? trigger.top - height - SELECT_DROPDOWN_GAP
    : trigger.bottom + SELECT_DROPDOWN_GAP
  const top = Math.min(
    Math.max(viewport.height - height - SELECT_DROPDOWN_MARGIN, SELECT_DROPDOWN_MARGIN),
    Math.max(SELECT_DROPDOWN_MARGIN, rawTop)
  )
  const left = Math.min(
    Math.max(viewport.width - width - SELECT_DROPDOWN_MARGIN, SELECT_DROPDOWN_MARGIN),
    Math.max(SELECT_DROPDOWN_MARGIN, trigger.left)
  )
  return { top, left, width, maxHeight }
}
