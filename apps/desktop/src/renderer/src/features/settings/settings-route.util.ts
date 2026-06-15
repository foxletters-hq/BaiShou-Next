export const SETTINGS_HUB_PREFIX = '/hub'
export const SETTINGS_OVERLAY_PREFIX = '/settings'

export function isSettingsHubPath(pathname: string): boolean {
  return pathname === SETTINGS_HUB_PREFIX || pathname.startsWith(`${SETTINGS_HUB_PREFIX}/`)
}

export function isSettingsOverlayPath(pathname: string): boolean {
  return pathname === SETTINGS_OVERLAY_PREFIX || pathname.startsWith(`${SETTINGS_OVERLAY_PREFIX}/`)
}

/** 从 /hub/... 或 /settings/... 提取设置段，如 rag、workspaces */
export function getSettingsRouteSegment(pathname: string): string {
  if (pathname === SETTINGS_HUB_PREFIX || pathname === SETTINGS_OVERLAY_PREFIX) {
    return 'general'
  }
  if (pathname.startsWith(`${SETTINGS_HUB_PREFIX}/`)) {
    return pathname.slice(SETTINGS_HUB_PREFIX.length + 1)
  }
  if (pathname.startsWith(`${SETTINGS_OVERLAY_PREFIX}/`)) {
    return pathname.slice(SETTINGS_OVERLAY_PREFIX.length + 1)
  }
  return 'general'
}

export function settingsPathForScope(
  scope: 'hub' | 'overlay',
  segment: string
): string {
  const prefix = scope === 'hub' ? SETTINGS_HUB_PREFIX : SETTINGS_OVERLAY_PREFIX
  return segment === 'general' ? `${prefix}/general` : `${prefix}/${segment}`
}

export function settingsScopeFromPath(pathname: string): 'hub' | 'overlay' {
  return isSettingsHubPath(pathname) ? 'hub' : 'overlay'
}
