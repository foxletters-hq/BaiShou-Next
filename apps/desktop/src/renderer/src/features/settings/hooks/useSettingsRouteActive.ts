import { useLocation } from 'react-router-dom'
import { useDesktopSettingsOverlay } from '../../../layouts/desktop-settings-overlay.context'
import { SETTINGS_HUB_PREFIX } from '../settings-route.util'

/** 设置路由是否处于用户可见的活跃状态（全屏 overlay 或 /hub 内嵌） */
export function useSettingsRouteActive(): boolean {
  const overlayOpen = useDesktopSettingsOverlay()
  const location = useLocation()
  return overlayOpen || location.pathname.startsWith(SETTINGS_HUB_PREFIX)
}
