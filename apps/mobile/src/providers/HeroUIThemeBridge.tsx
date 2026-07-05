import React, { useEffect, useMemo } from 'react'
import { HeroUINativeProvider } from 'heroui-native/provider'
import { Uniwind } from 'uniwind'
import { useNativeTheme } from '@baishou/ui/native'

/**
 * HeroUI Native（Switch、Portal）+ 白守 Uniwind 主题。
 * 业务 ToastProvider 见 app/_layout.tsx（须在 HeroUINativeProvider 内）。
 */
export function HeroUIThemeBridge({ children }: { children: React.ReactNode }) {
  const { themeMode } = useNativeTheme()

  useEffect(() => {
    // system 模式须交给 Uniwind 跟随系统；显式 light/dark 才锁定 Appearance
    Uniwind.setTheme(themeMode === 'system' ? 'system' : themeMode)
  }, [themeMode])

  const providerConfig = useMemo(
    () => ({
      devInfo: {
        stylingPrinciples: false
      },
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
    <HeroUINativeProvider config={providerConfig}>{children}</HeroUINativeProvider>
  )
}
