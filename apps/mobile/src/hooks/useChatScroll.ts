import { useState, useRef, useCallback, useEffect } from 'react'
import type { FlatList } from 'react-native'

export interface UseChatScrollParams {
  messages: any[]
  isStreaming: boolean
  streamingText: string
}

export interface UseChatScrollResult {
  flatListRef: React.RefObject<FlatList<any> | null>
  showScrollButton: boolean
  scrollToBottom: (force?: boolean) => void
  handleScroll: (event: any) => void
}

/**
 * 聊天滚动管理 Hook
 *
 * 职责：
 * 1. 自动滚动到底部（新消息/流式输出时）
 * 2. 用户手动上翻时暂停自动滚动
 * 3. 显示"回到底部"按钮
 */
export function useChatScroll(params: UseChatScrollParams): UseChatScrollResult {
  const { messages, isStreaming, streamingText } = params

  const flatListRef = useRef<FlatList>(null)
  const isUserScrollingRef = useRef(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const prevMessageCountRef = useRef(0)

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const isAtBottom = contentSize.height - contentOffset.y - layoutMeasurement.height < 150
    isUserScrollingRef.current = !isAtBottom
    setShowScrollButton(!isAtBottom)
  }, [])

  const scrollToBottom = useCallback((force = false) => {
    if (flatListRef.current && (!isUserScrollingRef.current || force)) {
      flatListRef.current.scrollToEnd({ animated: true })
      if (force) {
        setShowScrollButton(false)
        isUserScrollingRef.current = false
      }
    }
  }, [])

  useEffect(() => {
    if (messages.length > 0 && messages.length !== prevMessageCountRef.current) {
      setTimeout(() => scrollToBottom(), 100)
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length, scrollToBottom])

  useEffect(() => {
    if (isStreaming || streamingText) {
      scrollToBottom()
    }
  }, [streamingText, isStreaming, scrollToBottom])

  return { flatListRef, showScrollButton, scrollToBottom, handleScroll }
}
