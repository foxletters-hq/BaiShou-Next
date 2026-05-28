type ThemeRefreshListener = () => void

const listeners = new Set<ThemeRefreshListener>()

export function subscribeThemeRefresh(listener: ThemeRefreshListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 设置页保存 themeMode / seedColor 后调用，刷新 NativeAppThemeBridge */
export function notifyThemeRefresh(): void {
  listeners.forEach((fn) => fn())
}
