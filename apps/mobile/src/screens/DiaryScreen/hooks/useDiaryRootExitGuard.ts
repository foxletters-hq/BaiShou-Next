import { useCallback, useRef } from 'react'
import { BackHandler } from 'react-native'
import { useFocusEffect, useNavigation } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { EventArg } from '@react-navigation/native'
import { useNativeToast } from '@baishou/ui/native'

const EXIT_CONFIRM_MS = 2000

type BeforeRemoveEvent = EventArg<'beforeRemove', true, { action: Readonly<{ type: string }> }>

/** 日记 Tab 根页：首次返回/滑动仅 toast，再次退出应用，避免闪到启动 Redirect 页 */
export function useDiaryRootExitGuard() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const navigation = useNavigation()
  const pendingExitRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dedupeBackRef = useRef(false)

  useFocusEffect(
    useCallback(() => {
      const clearPendingExit = () => {
        pendingExitRef.current = false
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
      }

      const handleExitAttempt = (): boolean => {
        if (dedupeBackRef.current) return true
        dedupeBackRef.current = true
        queueMicrotask(() => {
          dedupeBackRef.current = false
        })

        if (pendingExitRef.current) {
          clearPendingExit()
          BackHandler.exitApp()
          return true
        }

        pendingExitRef.current = true
        toast.showInfo(t('nav.swipe_again_to_exit', '再次滑动退出'))
        timerRef.current = setTimeout(clearPendingExit, EXIT_CONFIRM_MS)
        return true
      }

      const backSub = BackHandler.addEventListener('hardwareBackPress', handleExitAttempt)

      const onBeforeRemove = (event: BeforeRemoveEvent) => {
        event.preventDefault()
        handleExitAttempt()
      }

      const removeBeforeRemove = navigation.addListener('beforeRemove', onBeforeRemove)
      const stackNav = navigation.getParent()?.getParent()
      const removeStackBeforeRemove = stackNav?.addListener('beforeRemove', onBeforeRemove)

      return () => {
        backSub.remove()
        removeBeforeRemove()
        removeStackBeforeRemove?.()
        clearPendingExit()
      }
    }, [navigation, t, toast])
  )
}
