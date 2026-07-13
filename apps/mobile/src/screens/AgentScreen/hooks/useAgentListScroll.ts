import { useCallback, useEffect, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native'
import type { RefObject } from 'react'

export function useAgentListScrollHandlers(deps: {
  flatListRef: RefObject<ScrollView | null>
  scrollOffsetRef: RefObject<number>
  layoutReadyRef: RefObject<boolean>
  handleContentSizeChange: (ref: RefObject<ScrollView | null>, height: number) => void
  handleIntrinsicContentHeightChange: (height: number) => void
  handleChatListScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  hasMore: boolean
  currentSessionId: string | null
}) {
  const {
    flatListRef,
    scrollOffsetRef,
    layoutReadyRef,
    handleContentSizeChange,
    handleIntrinsicContentHeightChange,
    handleChatListScroll,
    hasMore,
    currentSessionId
  } = deps

  const [showLoadMoreBanner, setShowLoadMoreBanner] = useState(false)

  const handleListContentSizeChange = useCallback(
    (_width: number, height: number) => {
      handleContentSizeChange(flatListRef, height)
    },
    [handleContentSizeChange, flatListRef]
  )

  const handleListIntrinsicContentHeightChange = useCallback(
    (height: number) => {
      handleIntrinsicContentHeightChange(height)
    },
    [handleIntrinsicContentHeightChange]
  )

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y
      handleChatListScroll(event)

      const nearTop = event.nativeEvent.contentOffset.y < 100
      const nextShowLoadMore = hasMore && nearTop
      setShowLoadMoreBanner((prev) => (prev === nextShowLoadMore ? prev : nextShowLoadMore))
    },
    [handleChatListScroll, hasMore, scrollOffsetRef]
  )

  useEffect(() => {
    layoutReadyRef.current = false
  }, [currentSessionId, layoutReadyRef])

  useEffect(() => {
    if (!hasMore) {
      setShowLoadMoreBanner(false)
    }
  }, [hasMore])

  return {
    showLoadMoreBanner,
    handleListContentSizeChange,
    handleListIntrinsicContentHeightChange,
    handleListScroll
  }
}
