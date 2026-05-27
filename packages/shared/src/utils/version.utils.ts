/** Shown in About / updater UI when package version is unavailable */
export const APP_DISPLAY_VERSION = '4.0.0'

/** Normalize version strings to a single leading `v` (fixes `vv2.0.0` style bugs). */
export function formatAppVersion(raw: string | undefined | null): string {
  const cleaned = (raw ?? APP_DISPLAY_VERSION).trim().replace(/^v+/i, '')
  return `v${cleaned || APP_DISPLAY_VERSION}`
}
