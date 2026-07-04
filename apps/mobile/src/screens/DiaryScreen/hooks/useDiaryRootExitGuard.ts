import { useCallback, useRef } from 'react'
import { BackHandler } from 'react-native'
import { useFocusEffect, useNavigation } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { EventArg, NavigationProp, ParamListBase } from '@react-navigation/native'
import { useNativeToast } from '@baishou/ui/native'
import { isDiaryEditorRouteActive } from '../diary-editor-route.util'

const EXIT_CONFIRM_MS = 2500

type BeforeRemoveEvent = EventArg<'beforeRemove', true, { action: Readonly<{ type: string }> }>

/** 日记 Tab 根页：首次返回/滑动仅 toast，再次退出应用，避免闪到启动 Redirect 页 */
export function useDiaryRootExitGuard() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const navigation = useNavigation()
  const pendingExitRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dedupeBackRef = useRef(false)
  // toast 展示会改变 isToastVisible，进而让 useNativeToast() 返回新引用；
  // 若放进 useFocusEffect 依赖，会在 toast 弹出时误触发 cleanup 并重置 pendingExit。
  const toastRef = useRef(toast)
  toastRef.current = toast

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
        if (pendingExitRef.current) {
          clearPendingExit()
          BackHandler.exitApp()
          return true
        }

        if (dedupeBackRef.current) return true
        dedupeBackRef.current = true
        queueMicrotask(() => {
          dedupeBackRef.current = false
        })

        pendingExitRef.current = true
        toastRef.current.showInfo(t('nav.swipe_again_to_exit', '再次滑动退出'), {
          duration: EXIT_CONFIRM_MS,
          onDismiss: clearPendingExit
        })
        timerRef.current = setTimeout(clearPendingExit, EXIT_CONFIRM_MS)
        return true
      }

      const backSub = BackHandler.addEventListener('hardwareBackPress', handleExitAttempt)

      const onBeforeRemove = (event: BeforeRemoveEvent) => {
        const nav = navigation as NavigationProp<ParamListBase>
        if (isDiaryEditorRouteActive(nav)) return
        const actionType = event.data.action.type
        if (actionType !== 'GO_BACK' && actionType !== 'POP') return
        event.preventDefault()
        handleExitAttempt()
      }

      const removeBeforeRemove = navigation.addListener('beforeRemove', onBeforeRemove)

      return () => {
        backSub.remove()
        removeBeforeRemove()
        clearPendingExit()
      }
    }, [navigation, t])
  )
}
