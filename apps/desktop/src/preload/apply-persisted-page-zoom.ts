import { webFrame } from 'electron'
import {
  UI_SETTINGS_STORAGE_KEY,
  uiPageZoomFromPersistedSettingsJson
} from '@baishou/shared'

function clampPageZoom(factor: number): number {
  return Math.min(2, Math.max(0.5, Math.round(factor * 100) / 100))
}

/** 在 React 水合前套上已保存的整页缩放，避免先以 100% 显示再跳回。 */
export function applyPersistedPageZoom(): void {
  try {
    const factor = uiPageZoomFromPersistedSettingsJson(
      window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY)
    )
    if (factor == null) return
    webFrame.setZoomFactor(clampPageZoom(factor))
  } catch {
    /* localStorage / webFrame 尚未可用时由 useZoom 再套一次 */
  }
}
