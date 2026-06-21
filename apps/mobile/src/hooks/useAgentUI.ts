import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatLocalDateFromInstant, timestampToMillis } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import type { RecallItem } from '@baishou/ui/native'

const formatRecallDate = (ts: unknown) => {
  const raw = typeof ts === 'number' ? ts : new Date(ts as string | Date).getTime()
  const ms = timestampToMillis(Number.isFinite(raw) ? raw : undefined)
  return formatLocalDateFromInstant(ms ?? Date.now()) ?? ''
}

export function useAgentUI() {
  const { t } = useTranslation()
  const { services } = useBaishou()

  const [showCostDialog, setShowCostDialog] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [showShortcutSheet, setShowShortcutSheet] = useState(false)
  const [showRecallSheet, setShowRecallSheet] = useState(false)
  const [recallItems, setRecallItems] = useState<RecallItem[]>([])
  const [isSearchingRecall, setIsSearchingRecall] = useState(false)
  const [recallSearchMode, setRecallSearchMode] = useState<'semantic' | 'text'>('semantic')
  const isUserScrollingRef = useRef(false)

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const isAtBottom = contentSize.height - contentOffset.y - layoutMeasurement.height < 150
    isUserScrollingRef.current = !isAtBottom
    setShowScrollButton(!isAtBottom)
  }, [])

  const scrollToBottom = useCallback((flatListRef: any, force = false) => {
    if (flatListRef.current && (!isUserScrollingRef.current || force)) {
      flatListRef.current.scrollToEnd({ animated: true })
      if (force) {
        setShowScrollButton(false)
        isUserScrollingRef.current = false
      }
    }
  }, [])

  const handleRecallSearch = useCallback(
    async (query: string, tab: 'diary' | 'memory', mode?: 'semantic' | 'text') => {
      if (!services) return
      setIsSearchingRecall(true)
      try {
        if (tab === 'diary') {
          const dbEntries = await services.diaryService.search(query)
          if (dbEntries) {
            setRecallItems(
              dbEntries.map((d: any) => ({
                id: d.id.toString(),
                type: 'diary' as const,
                title: d.title || t('common.untitled', '无标题'),
                snippet: d.snippet || d.content?.substring(0, 100) || '',
                date: formatRecallDate(d.createdAt)
              }))
            )
          } else {
            setRecallItems([])
          }
          return
        }

        const trimmed = query.trim()
        if (!trimmed) {
          setRecallItems([])
          return
        }

        const searchMode = mode || recallSearchMode
        const res = await services.ragService.queryEntries({
          keyword: trimmed,
          limit: 50,
          mode: searchMode
        })

        setRecallItems(
          res.entries.map((row) => ({
            id: String(row.embeddingId ?? row.sourceId ?? row.id),
            type: 'memory' as const,
            title: t('agent.recall.memory', '记忆'),
            snippet: String(row.text ?? '').substring(0, 150),
            date: row.createdAt ? formatRecallDate(Number(row.createdAt)) : '',
            similarity: typeof row.similarity === 'number' ? row.similarity : undefined
          }))
        )
      } catch (err) {
        console.error('[AgentUI] Search fail:', err)
        setRecallItems([])
      } finally {
        setIsSearchingRecall(false)
      }
    },
    [services, t, recallSearchMode]
  )

  const toggleRecallSearchMode = useCallback(() => {
    setRecallSearchMode((prev) => (prev === 'semantic' ? 'text' : 'semantic'))
  }, [])

  const handleInjectRecall = useCallback((items: RecallItem[]) => {
    setShowRecallSheet(false)
  }, [])

  return {
    showCostDialog,
    showScrollButton,
    showShortcutSheet,
    showRecallSheet,
    recallItems,
    isSearchingRecall,
    setShowCostDialog,
    setShowScrollButton,
    setShowShortcutSheet,
    setShowRecallSheet,
    handleScroll,
    scrollToBottom,
    handleRecallSearch,
    handleInjectRecall,
    recallSearchMode,
    toggleRecallSearchMode
  }
}
