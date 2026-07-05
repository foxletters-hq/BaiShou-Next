import { useCallback, useEffect, useState } from 'react'
import {
  clampSharedMemoryLookbackMonths,
  DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS,
  type SummaryConfig
} from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'

export function usePersistedSharedMemoryLookback() {
  const { services } = useBaishou()
  const [lookbackMonths, setLookbackMonthsState] = useState(DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const settingsManager = services?.settingsManager
    if (!settingsManager) return

    let cancelled = false

    void (async () => {
      try {
        const config = (await settingsManager.get<SummaryConfig>('summary_config')) || {}
        if (!cancelled) {
          setLookbackMonthsState(clampSharedMemoryLookbackMonths(config.sharedMemoryLookbackMonths))
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
  }, [services?.settingsManager])

  const setLookbackMonths = useCallback(
    (value: number) => {
      const clamped = clampSharedMemoryLookbackMonths(value)
      setLookbackMonthsState(clamped)

      const settingsManager = services?.settingsManager
      if (!settingsManager) return

      void (async () => {
        try {
          const existing = (await settingsManager.get<SummaryConfig>('summary_config')) || {}
          await settingsManager.set('summary_config', {
            ...existing,
            sharedMemoryLookbackMonths: clamped
          })
        } catch {
          /* 持久化失败不影响当前会话内的选择 */
        }
      })()
    },
    [services?.settingsManager]
  )

  return { lookbackMonths, setLookbackMonths, ready }
}
