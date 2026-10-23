/** Global class from theme/app-chrome.css — clips portal overlays to the main content card. */
export const APP_CONTENT_OVERLAY_CLASS = 'baishou-app-content-overlay'

export type AppContentOverlayOptions = {
  /**
   * When true, do not clip to the content card (full window, including TitleBar area).
   * Use for immersive surfaces such as image lightbox.
   */
  fullWindow?: boolean
}

/** Compose overlay className with the shared content-card clip (SOLID: one chrome policy). */
export function withAppContentOverlay(
  className?: string | null,
  options?: AppContentOverlayOptions
): string {
  const base = typeof className === 'string' ? className.trim() : ''
  if (options?.fullWindow) return base
  return [APP_CONTENT_OVERLAY_CLASS, base].filter(Boolean).join(' ')
}
