import React, { useEffect, useMemo } from 'react'
import { HeroUINativeProvider } from 'heroui-native/provider'
import { Uniwind } from 'uniwind'
import { ToastProvider, useNativeTheme } from '@baishou/ui/native'

/**
 * HeroUI Native（Switch、Toast、Portal）+ 白守 Uniwind 主题。
 * Toast 直接使用 Hero 默认安全区与动画，不覆盖 top inset。
 */
export function HeroUIThemeBridge({ children }: { children: React.ReactNode }) {
  const { isDark } = useNativeTheme()

  useEffect(() => {
    Uniwind.setTheme(isDark ? 'dark' : 'light')
  }, [isDark])

  const providerConfig = useMemo(
    () => ({
      toast: {
        maxVisibleToasts: 1,
        defaultProps: {
          placement: 'top' as const,
          isSwipeable: true
        }
      }
    }),
    []
  )

  return (
    <HeroUINativeProvider config={providerConfig}>
      <ToastProvider>{children}</ToastProvider>
    </HeroUINativeProvider>
  )
}
