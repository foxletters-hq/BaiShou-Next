let settingsEntryPrefetched = false

/** 鼠标悬停设置入口时预拉 JS 分包，缩短首次打开耗时 */
export function prefetchSettingsEntry(): void {
  if (settingsEntryPrefetched) return
  settingsEntryPrefetched = true
  void import('../features/settings/SettingsPage')
}
