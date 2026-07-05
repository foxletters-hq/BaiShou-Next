import { useCallback, useEffect, useState } from 'react'
import type { SummaryConfig } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'

export function usePersistedSharedMemoryCopyPrefix() {
  const { services } = useBaishou()
  const [copyPrefix, setCopyPrefixState] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const settingsManager = services?.settingsManager
    if (!settingsManager) return

    let cancelled = false

    void (async () => {
      try {
        const config = (await settingsManager.get<SummaryConfig>('summary_config')) || {}
        if (!cancelled) {
          setCopyPrefixState(config.sharedMemoryCopyPrefix?.trim() ?? '')
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

  const setCopyPrefix = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      setCopyPrefixState(trimmed)

      const settingsManager = services?.settingsManager
      if (!settingsManager) return

      void (async () => {
        try {
          const existing = (await settingsManager.get<SummaryConfig>('summary_config')) || {}
          await settingsManager.set('summary_config', {
            ...existing,
            sharedMemoryCopyPrefix: trimmed || undefined
          })
        } catch {
          /* 持久化失败不影响当前会话内的选择 */
        }
      })()
    },
    [services?.settingsManager]
  )

  return { copyPrefix, setCopyPrefix, ready }
}
