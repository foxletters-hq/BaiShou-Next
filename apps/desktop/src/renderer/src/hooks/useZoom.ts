import { useEffect, useState } from 'react'
import {
  normalizeUiFontSizeLevel,
  resolvePageZoomShortcut,
  nextUiFontSizeLevel,
  uiPageZoomFromLevel
} from '@baishou/shared'
import { useSettingsStore } from '@baishou/store'

function isApiReady(): boolean {
  return !!(window as any)?.api?.zoom?.setFactor
}

function applyPageZoom(factor: number) {
  if (!isApiReady()) return
  const clamped = Math.min(2, Math.max(0.5, Math.round(factor * 100) / 100))
  ;(window as any).api.zoom.setFactor(clamped)
}

function hasUiSettingsHydrated(): boolean {
  try {
    return useSettingsStore.persist?.hasHydrated?.() ?? true
  } catch {
    return true
  }
}

/**
 * 整页缩放：与常规设置「字体大小」同一数据源（fontSizeLevel，zustand persist）。
 * Ctrl +/- / 0 按档位调节；不会用快捷键时拖设置滑条即可。
 * 等 UI 偏好水合完成后再套 zoom，避免启动时先用默认档盖掉已保存值。
 */
export function useZoom() {
  const fontSizeLevel = useSettingsStore((s) => s.fontSizeLevel)
  const [hydrated, setHydrated] = useState(hasUiSettingsHydrated)

  useEffect(() => {
    if (hydrated) return
    const persistApi = useSettingsStore.persist
    if (!persistApi?.onFinishHydration) {
      setHydrated(true)
      return
    }
    if (persistApi.hasHydrated?.()) {
      setHydrated(true)
      return
    }
    return persistApi.onFinishHydration(() => {
      setHydrated(true)
    })
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) return

    let retryTimer: ReturnType<typeof setInterval> | undefined
    const level = normalizeUiFontSizeLevel(fontSizeLevel)

    const tryApply = () => {
      if (!isApiReady()) return false
      applyPageZoom(uiPageZoomFromLevel(level))
      return true
    }

    if (!tryApply()) {
      retryTimer = setInterval(() => {
        if (tryApply() && retryTimer) clearInterval(retryTimer)
      }, 100)
    }

    return () => {
      if (retryTimer) clearInterval(retryTimer)
    }
  }, [fontSizeLevel, hydrated])

  useEffect(() => {
    const onLevelFromMain = (level: number) => {
      useSettingsStore.getState().setFontSizeLevel(level)
    }
    const offLevel = (window as any).api?.zoom?.onSetLevel?.(onLevelFromMain) as
      | (() => void)
      | undefined

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      const action = resolvePageZoomShortcut({ key: e.key, code: e.code })
      if (!action) return
      e.preventDefault()
      const store = useSettingsStore.getState()
      store.setFontSizeLevel(nextUiFontSizeLevel(store.fontSizeLevel, action))
    }

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      // 触控板捏合在 Chromium 里会合成 ctrl+wheel；这里只拦住默认缩放，
      // 避免双指滑动时误改整页大小。刻意缩放请用设置滑条或 Ctrl +/- / 0。
      e.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      offLevel?.()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])
}
