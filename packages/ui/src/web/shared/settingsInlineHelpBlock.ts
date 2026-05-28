import type { MouseEvent, PointerEvent, SyntheticEvent } from 'react'

/** Stop activation from bubbling to settings list / expansion rows. */
export function stopSettingsRowActivation(e: SyntheticEvent): void {
  e.stopPropagation()
}

/** True when the event target is inside an inline help control. */
export function isSettingsInlineHelpTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('.settings-inline-help-host'))
}

/** Block pointer events from reaching parent tiles (click, mousedown/mouseup split). */
export const settingsInlineHelpHostProps = {
  className: 'settings-inline-help-host',
  onClick: stopSettingsRowActivation,
  onMouseDown: stopSettingsRowActivation,
  onMouseUp: stopSettingsRowActivation,
  onPointerDown: stopSettingsRowActivation,
  onPointerUp: stopSettingsRowActivation
} as const

/** Merge with help button handlers so the button and host both isolate the row. */
export function mergeSettingsHelpButtonHandlers(
  onActivate: (e: MouseEvent<HTMLButtonElement>) => void
): {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  onMouseDown: (e: MouseEvent<HTMLButtonElement>) => void
  onMouseUp: (e: MouseEvent<HTMLButtonElement>) => void
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void
  onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void
} {
  return {
    onPointerDown: (e) => {
      stopSettingsRowActivation(e)
    },
    onPointerUp: (e) => {
      stopSettingsRowActivation(e)
    },
    onMouseDown: (e) => {
      stopSettingsRowActivation(e)
    },
    onMouseUp: (e) => {
      stopSettingsRowActivation(e)
    },
    onClick: (e) => {
      stopSettingsRowActivation(e)
      e.preventDefault()
      onActivate(e)
    }
  }
}
