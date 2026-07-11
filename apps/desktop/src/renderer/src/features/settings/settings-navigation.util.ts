const SETTINGS_RETURN_PATH_KEY = 'desktop_settings_return_path'

/** 记住离开设置前的完整路径（含 search），避免返回时丢掉 assistantId 导致伙伴页重载闪烁 */
export function rememberSettingsReturnPath(pathWithSearch: string) {
  const path = pathWithSearch.split('?')[0] || pathWithSearch
  if (path.startsWith('/settings') || path.startsWith('/hub')) return
  sessionStorage.setItem(SETTINGS_RETURN_PATH_KEY, pathWithSearch)
}

export function resolveSettingsReturnPath(): string {
  const stored = sessionStorage.getItem(SETTINGS_RETURN_PATH_KEY)
  if (stored) {
    const path = stored.split('?')[0] || stored
    if (!path.startsWith('/settings') && !path.startsWith('/hub')) return stored
  }

  const lastNav = sessionStorage.getItem('desktop_last_nav')
  if (lastNav) {
    const path = lastNav.split('?')[0] || lastNav
    if (!path.startsWith('/settings') && !path.startsWith('/hub')) return lastNav
  }

  return '/diary'
}

export function locationToReturnPath(location: { pathname: string; search?: string }): string {
  return `${location.pathname}${location.search || ''}`
}
