import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useBaishou } from '../providers/BaishouProvider'
import type { RecallItem } from '@baishou/ui/native'

export function useAgentUI() {
  const { t } = useTranslation()
  const { services } = useBaishou()

  const [showCostDialog, setShowCostDialog] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [showShortcutSheet, setShowShortcutSheet] = useState(false)
  const [showRecallSheet, setShowRecallSheet] = useState(false)
  const [showToolManager, setShowToolManager] = useState(false)
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
    async (query: string, tab: 'diary' | 'memory', _mode?: 'semantic' | 'text') => {
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
                date: new Date(d.createdAt).toISOString().split('T')[0]
              }))
            )
          } else {
            setRecallItems([])
          }
        } else {
          const memoryResults = await services.memorySearch?.(query, {
            topK: 20,
            minScore: 0.3
          })
          if (memoryResults && memoryResults.length > 0) {
            setRecallItems(
              memoryResults.map((r, index) => ({
                id: `memory_${index}`,
                type: 'memory' as const,
                title: t('agent.recall.memory', '记忆'),
                snippet: r.chunkText.substring(0, 150),
                date: r.createdAt
                  ? new Date(r.createdAt * 1000).toISOString().split('T')[0]
                  : '',
                similarity: r.score
              }))
            )
          } else {
            setRecallItems([])
          }
        }
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
    showToolManager,
    recallItems,
    isSearchingRecall,
    setShowCostDialog,
    setShowScrollButton,
    setShowShortcutSheet,
    setShowRecallSheet,
    setShowToolManager,
    handleScroll,
    scrollToBottom,
    handleRecallSearch,
    handleInjectRecall,
    recallSearchMode,
    toggleRecallSearchMode
  }
}
