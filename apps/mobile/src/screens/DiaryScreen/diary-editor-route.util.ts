type AnyNavigation = {
  getState(): unknown
  getParent(): AnyNavigation | undefined
}

function hasDiaryEditorRoute(state: unknown): boolean {
  if (!state || typeof state !== 'object') return false
  const routes = (state as { routes?: { name?: string }[] }).routes
  return routes?.some((route) => route.name === 'diary-editor') ?? false
}

/** 导航栈中是否仍挂着 diary-editor 模态 */
export function isDiaryEditorRouteActive(navigation: AnyNavigation): boolean {
  let current: AnyNavigation | undefined = navigation
  while (current) {
    if (hasDiaryEditorRoute(current.getState())) {
      return true
    }
    current = current.getParent?.()
  }
  return false
}
