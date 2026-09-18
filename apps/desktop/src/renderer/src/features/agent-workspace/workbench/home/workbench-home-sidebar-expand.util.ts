const EXPANDED_STORAGE_KEY = 'baishou:workbench-home-recent-expanded'

export function readExpandedPreference(): boolean {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY)
    if (raw === null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function writeExpandedPreference(expanded: boolean): void {
  try {
    localStorage.setItem(EXPANDED_STORAGE_KEY, expanded ? '1' : '0')
  } catch {
    /* ignore */
  }
}
