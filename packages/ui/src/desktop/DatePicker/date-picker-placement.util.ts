export const DATE_PICKER_DROPDOWN_WIDTH = 280
export const DATE_PICKER_DROPDOWN_HEIGHT = 330
export const DATE_PICKER_GAP = 4
export const DATE_PICKER_MARGIN = 8

export function resolveDatePickerPlacement(
  trigger: { top: number; bottom: number; left: number; right: number; width: number },
  viewport: { width: number; height: number },
  dropdownWidth = DATE_PICKER_DROPDOWN_WIDTH,
  dropdownHeight = DATE_PICKER_DROPDOWN_HEIGHT
): { top: number; left: number } {
  const spaceBelow = viewport.height - trigger.bottom - DATE_PICKER_MARGIN
  const spaceAbove = trigger.top - DATE_PICKER_MARGIN
  const openUp = spaceBelow < dropdownHeight + DATE_PICKER_GAP && spaceAbove > spaceBelow

  const rawTop = openUp
    ? trigger.top - dropdownHeight - DATE_PICKER_GAP
    : trigger.bottom + DATE_PICKER_GAP

  const top = Math.min(
    Math.max(viewport.height - dropdownHeight - DATE_PICKER_MARGIN, DATE_PICKER_MARGIN),
    Math.max(DATE_PICKER_MARGIN, rawTop)
  )

  let left = trigger.left
  if (left + dropdownWidth > viewport.width - DATE_PICKER_MARGIN) {
    left = Math.max(DATE_PICKER_MARGIN, trigger.right - dropdownWidth)
  }
  if (left + dropdownWidth > viewport.width - DATE_PICKER_MARGIN) {
    left = Math.max(DATE_PICKER_MARGIN, viewport.width - dropdownWidth - DATE_PICKER_MARGIN)
  }

  return { top, left }
}
