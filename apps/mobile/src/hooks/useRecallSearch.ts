import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatRecallDiaryDate, formatRecallTimestamp } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'

export interface RecallItem {
  id: string
  type: string
  title: string
  snippet: string
  date: string
  similarity?: number
}

export interface UseRecallSearchResult {
  recallItems: RecallItem[]
  isSearchingRecall: boolean
  handleRecallSearch: (query: string, tab: 'diary' | 'memory') => Promise<void>
}

/**
 * 回忆搜索 Hook
 *
 * 职责：搜索日记和 RAG 记忆，返回可注入的回忆条目
 */
export function useRecallSearch(): UseRecallSearchResult {
  const { t } = useTranslation()
  const { services } = useBaishou()
  const [recallItems, setRecallItems] = useState<RecallItem[]>([])
  const [isSearchingRecall, setIsSearchingRecall] = useState(false)

  const handleRecallSearch = useCallback(
    async (query: string, tab: 'diary' | 'memory') => {
      setIsSearchingRecall(true)
      try {
        if (tab === 'diary') {
          const dbEntries = await services?.diaryService?.search(query)
          if (dbEntries) {
            setRecallItems(
              dbEntries.map((d: any) => ({
                id: d.id.toString(),
                type: 'diary' as const,
                title: d.title || t('common.untitled', '无标题'),
                snippet: d.snippet || d.content?.substring(0, 100) || '',
                date: formatRecallDiaryDate(d.date ?? d.updatedAt)
              }))
            )
          } else {
            setRecallItems([])
          }
        } else {
          const trimmed = query.trim()
          if (!trimmed) {
            setRecallItems([])
            return
          }
          // RAG 语义记忆搜索：使用向量嵌入 + 混合搜索（FTS + 向量 RRF 融合）
          const memoryResults = await services?.memorySearch?.(trimmed, { topK: 20, minScore: 0.3 })
          if (memoryResults && memoryResults.length > 0) {
            setRecallItems(
              memoryResults.map((r, index) => ({
                id: `memory_${index}`,
                type: 'memory' as const,
                title: t('agent.recall.memory', '记忆'),
                snippet: r.chunkText.substring(0, 150),
                date: formatRecallTimestamp(r.createdAt),
                similarity: r.score
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
    [services, t]
  )

  return { recallItems, isSearchingRecall, handleRecallSearch }
}
