import { useCallback, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'

/** 页面聚焦时刷新，但限制最短间隔，避免 Tab 切换触发重复重查询 */
export function useThrottledFocusRefresh(
  refresh: () => void,
  throttleMs = 2000
): void {
  const lastRunRef = useRef(0)

  useFocusEffect(
    useCallback(() => {
      const now = Date.now()
      if (now - lastRunRef.current < throttleMs) return
      lastRunRef.current = now
      refresh()
    }, [refresh, throttleMs])
  )
}
