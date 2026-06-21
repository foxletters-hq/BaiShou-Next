import { useEffect } from 'react'
import { useNavigation } from 'expo-router'
import { useIncrementalSync } from '../providers/IncrementalSyncProvider'

/** 增量同步进行中禁用页面侧滑返回，避免未处理的回退与状态卡死 */
export function useIncrementalSyncNavigationGuard(): void {
  const navigation = useNavigation()
  const { isBusy } = useIncrementalSync()

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !isBusy,
      fullScreenGestureEnabled: !isBusy
    })
  }, [isBusy, navigation])
}
