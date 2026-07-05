import type { NavigationProp, ParamListBase } from '@react-navigation/native'

type AnyNavigation = NavigationProp<ParamListBase> | Omit<NavigationProp<ParamListBase>, 'getState'>

/** 导航栈中是否仍挂着 diary-editor 模态 */
export function isDiaryEditorRouteActive(navigation: AnyNavigation): boolean {
  let current: AnyNavigation | undefined = navigation
  while (current) {
    const state = current.getState()
    if (state?.routes?.some((route) => route.name === 'diary-editor')) {
      return true
    }
    current = current.getParent?.() as AnyNavigation | undefined
  }
  return false
}
