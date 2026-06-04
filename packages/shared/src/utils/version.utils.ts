/** Shown in About / updater UI when package version is unavailable */
export const APP_DISPLAY_VERSION = 'Next-1.0.0'

/** Normalize version strings for About / updater UI (Next line uses `Next x.y.z`, others use `vx.y.z`). */
export function formatAppVersion(raw: string | undefined | null): string {
  const cleaned = (raw ?? APP_DISPLAY_VERSION).trim().replace(/^v+/i, '')
  if (!cleaned) return 'Next 1.0.0'

  if (/^next/i.test(cleaned)) {
    const suffix = cleaned.replace(/^next[-.\s]*/i, '').trim()
    return suffix ? `Next ${suffix}` : 'Next'
  }

  return `v${cleaned}`
}
