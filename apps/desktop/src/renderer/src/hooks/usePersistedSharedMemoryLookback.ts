import { useCallback, useEffect, useState } from 'react'
import {
  clampSharedMemoryLookbackMonths,
  DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS,
  type SummaryConfig
} from '@baishou/shared'

export function usePersistedSharedMemoryLookback() {
  const [lookbackMonths, setLookbackMonthsState] = useState(DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const config = (await window.api?.settings?.getSummaryConfig?.()) as SummaryConfig | null
        if (!cancelled) {
          setLookbackMonthsState(
            clampSharedMemoryLookbackMonths(config?.sharedMemoryLookbackMonths)
          )
        }
      } catch {
        /* 读取失败时保留默认值 */
      } finally {
        if (!cancelled) setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const setLookbackMonths = useCallback((value: number) => {
    const clamped = clampSharedMemoryLookbackMonths(value)
    setLookbackMonthsState(clamped)

    void (async () => {
      try {
        const existing =
          ((await window.api?.settings?.getSummaryConfig?.()) as SummaryConfig | null) || {}
        await window.api?.settings?.setSummaryConfig?.({
          ...existing,
          sharedMemoryLookbackMonths: clamped
        })
      } catch {
        /* 持久化失败不影响当前会话内的选择 */
      }
    })()
  }, [])

  return { lookbackMonths, setLookbackMonths, ready }
}
