const SETTINGS_RETURN_PATH_KEY = 'desktop_settings_return_path'

export function rememberSettingsReturnPath(pathname: string) {
  if (pathname.startsWith('/settings')) return
  sessionStorage.setItem(SETTINGS_RETURN_PATH_KEY, pathname)
}

export function resolveSettingsReturnPath(): string {
  const stored = sessionStorage.getItem(SETTINGS_RETURN_PATH_KEY)
  if (stored && !stored.startsWith('/settings')) return stored

  const lastNav = sessionStorage.getItem('desktop_last_nav')
  if (lastNav && !lastNav.startsWith('/settings')) return lastNav

  return '/diary'
}
