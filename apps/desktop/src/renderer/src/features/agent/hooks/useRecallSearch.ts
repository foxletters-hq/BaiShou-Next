import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { RecallItem } from '@baishou/ui'

export interface UseRecallSearchResult {
  recallItems: RecallItem[]
  isSearchingRecall: boolean
  handleRecallSearch: (
    query: string,
    tab: 'diary' | 'memory',
    mode?: 'semantic' | 'text'
  ) => Promise<void>
  recallSearchMode: 'semantic' | 'text'
  toggleRecallSearchMode: () => void
}

/**
 * 回忆搜索 Hook
 *
 * 职责：搜索日记和 RAG 记忆，返回可注入的回忆条目
 */
const ensureMillis = (ts: any) => {
  if (!ts) return Date.now()
  let num = typeof ts === 'number' ? ts : new Date(ts).getTime()
  if (isNaN(num)) return Date.now()

  // 智能循环规整：确保时间戳落在 13 位毫秒级范围内（约 1e11 到 1e14）
  // 1e11 毫秒是 1973 年，1e14 毫秒是 5138 年
  while (num > 1e14) {
    num = Math.floor(num / 1000)
  }
  while (num < 1e11 && num > 0) {
    num = num * 1000
  }
  return num
}

export function useRecallSearch(): UseRecallSearchResult {
  const { t } = useTranslation()
  const [recallItems, setRecallItems] = useState<RecallItem[]>([])
  const [isSearchingRecall, setIsSearchingRecall] = useState(false)
  const [recallSearchMode, setRecallSearchMode] = useState<'semantic' | 'text'>('semantic')

  const toggleRecallSearchMode = useCallback(() => {
    setRecallSearchMode((prev) => (prev === 'semantic' ? 'text' : 'semantic'))
  }, [])

  const handleRecallSearch = useCallback(
    async (query: string, tab: 'diary' | 'memory', mode?: 'semantic' | 'text') => {
      setIsSearchingRecall(true)
      try {
        if (tab === 'diary') {
          const dbEntries = await (window as any).api?.diary?.search(query)
          if (dbEntries) {
            setRecallItems(
              dbEntries.map((d: any) => ({
                id: d.id.toString(),
                type: 'diary',
                title: d.title || t('common.untitled', '无标题'),
                snippet: d.snippet || d.content?.substring(0, 100) || '',
                date: (() => {
                  const dt = new Date(ensureMillis(d.createdAt))
                  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
                })()
              }))
            )
          } else {
            setRecallItems([])
          }
        } else {
          const searchMode = mode || recallSearchMode
          const dbEntries = await (window as any).api?.rag?.queryEntries({
            keyword: query,
            limit: 50, // 语义检索召回更多以备分页，50条
            mode: searchMode
          })
          if (dbEntries) {
            setRecallItems(
              dbEntries.map((r: any) => ({
                id: r.embeddingId,
                type: 'memory',
                title: `[${r.modelId || t('common.system', '系统')}]`,
                snippet: r.text,
                date: (() => {
                  const dt = new Date(ensureMillis(r.createdAt))
                  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
                })(),
                similarity: r.similarity
              }))
            )
          } else {
            setRecallItems([])
          }
        }
      } catch (err) {
        console.error('[useRecallSearch] Search fail:', err)
        setRecallItems([])
      } finally {
        setIsSearchingRecall(false)
      }
    },
    [t, recallSearchMode]
  )

  return {
    recallItems,
    isSearchingRecall,
    handleRecallSearch,
    recallSearchMode,
    toggleRecallSearchMode
  }
}
