import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  DEFAULT_MARKDOWN_TOOLBAR_ORDER,
  normalizeMarkdownToolbarOrder,
  type MarkdownToolbarToolId
} from '@baishou/ui/native'

const STORAGE_KEY = 'diary_markdown_toolbar_order_v2'
const LEGACY_STORAGE_KEY = 'diary_markdown_toolbar_order_v1'

export function useMarkdownToolbarOrder() {
  const [toolOrder, setToolOrder] = useState<MarkdownToolbarToolId[]>([
    ...DEFAULT_MARKDOWN_TOOLBAR_ORDER
  ])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        let raw = await AsyncStorage.getItem(STORAGE_KEY)
        if (!raw) {
          raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY)
        }
        if (cancelled) return
        if (raw) {
          const parsed = JSON.parse(raw) as string[]
          const normalized = normalizeMarkdownToolbarOrder(parsed)
          setToolOrder(normalized)
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
        }
      } catch {
        // 读取失败时使用默认顺序
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const saveToolOrder = useCallback((next: MarkdownToolbarToolId[]) => {
    const normalized = normalizeMarkdownToolbarOrder(next)
    setToolOrder(normalized)
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)).catch(() => {
      // 持久化失败时仍保留内存中的顺序
    })
  }, [])

  return { toolOrder, saveToolOrder, ready }
}
