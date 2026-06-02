import React from 'react'

const PANEL_ANIM_MS = 340

/**
 * 挂载面板 DOM 并驱动进出场 CSS 过渡（遮罩淡入 + 侧栏滑入）。
 */
export function usePanelTransition(isOpen: boolean) {
  const [mounted, setMounted] = React.useState(false)
  const [active, setActive] = React.useState(false)

  React.useEffect(() => {
    if (isOpen) {
      setMounted(true)
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setActive(true))
      })
      return () => cancelAnimationFrame(raf)
    }

    const raf = requestAnimationFrame(() => setActive(false))
    const timer = window.setTimeout(() => setMounted(false), PANEL_ANIM_MS)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [isOpen])

  React.useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    if (active) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted, active])

  return { mounted, active, animMs: PANEL_ANIM_MS }
}
