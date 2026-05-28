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
    async (query: string, tab: 'diary' | 'memory') => {
      if (!services) return
      setIsSearchingRecall(true)
      try {
        if (tab === 'diary') {
          const dbEntries = await services.diaryService.search(query)
          if (dbEntries) {
            setRecallItems(
              dbEntries.map((d: any) => ({
                id: d.id.toString(),
                type: 'diary',
                title: d.title || t('common.untitled', '无标题'),
                snippet: d.snippet || d.content?.substring(0, 100) || '',
                date: new Date(d.createdAt).toISOString().split('T')[0]
              }))
            )
          } else {
            setRecallItems([])
          }
        } else {
          const memoryEntries = await services.diaryService.search(query)
          if (memoryEntries) {
            setRecallItems(
              memoryEntries.map((d: any) => ({
                id: d.id.toString(),
                type: 'memory',
                title: d.title || t('agent.chat.memory', 'AI 记忆'),
                snippet: d.snippet || d.content?.substring(0, 150) || '',
                date: new Date(d.createdAt).toISOString().split('T')[0],
                similarity: d.rankScore
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
    [services, t]
  )

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
    handleInjectRecall
  }
}
