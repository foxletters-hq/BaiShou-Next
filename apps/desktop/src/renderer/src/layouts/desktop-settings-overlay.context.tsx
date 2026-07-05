import { createContext, useContext } from 'react'

/** 全屏 /settings/* overlay 是否打开（底层路由仍停留在聊天等页面） */
export const DesktopSettingsOverlayContext = createContext(false)

export function useDesktopSettingsOverlay(): boolean {
  return useContext(DesktopSettingsOverlayContext)
}
