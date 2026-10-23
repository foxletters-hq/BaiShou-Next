import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeSharedMemoryCopyPrefix, type SummaryConfig } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'

export function usePersistedSharedMemoryCopyPrefix() {
  const { services } = useBaishou()
  const { t } = useTranslation()
  const defaultPrefix = t('summary.copy_prefix_default', '这是我们的回忆')
  const [copyPrefix, setCopyPrefixState] = useState(defaultPrefix)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const settingsManager = services?.settingsManager
    if (!settingsManager) return

    let cancelled = false

    void (async () => {
      try {
        const config = (await settingsManager.get<SummaryConfig>('summary_config')) || {}
        if (!cancelled) {
          const stored = normalizeSharedMemoryCopyPrefix(config.sharedMemoryCopyPrefix)
          setCopyPrefixState(stored || defaultPrefix)
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
  }, [services?.settingsManager, defaultPrefix])

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
