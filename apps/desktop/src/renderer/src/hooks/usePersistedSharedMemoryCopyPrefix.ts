import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeSharedMemoryCopyPrefix, type SummaryConfig } from '@baishou/shared'

export function usePersistedSharedMemoryCopyPrefix() {
  const { t } = useTranslation()
  const defaultPrefix = t('summary.copy_prefix_default', '这是我们的回忆')
  const [copyPrefix, setCopyPrefixState] = useState(defaultPrefix)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const config = (await window.api?.settings?.getSummaryConfig?.()) as SummaryConfig | null
        if (!cancelled) {
          const stored = normalizeSharedMemoryCopyPrefix(config?.sharedMemoryCopyPrefix)
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
  }, [defaultPrefix])

  const setCopyPrefix = useCallback((value: string) => {
    const trimmed = value.trim()
    setCopyPrefixState(trimmed)

    void (async () => {
      try {
        const existing =
          ((await window.api?.settings?.getSummaryConfig?.()) as SummaryConfig | null) || {}
        await window.api?.settings?.setSummaryConfig?.({
          ...existing,
          sharedMemoryCopyPrefix: trimmed || undefined
        })
      } catch {
        /* 持久化失败不影响当前会话内的选择 */
      }
    })()
  }, [])

  return { copyPrefix, setCopyPrefix, ready }
}
