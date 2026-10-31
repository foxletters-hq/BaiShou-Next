import { useCallback, useEffect, useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native'
import type { RefObject } from 'react'

const LOAD_EARLIER_TOP_THRESHOLD_PX = 48

export function useAgentListScrollHandlers(deps: {
  flatListRef: RefObject<ScrollView | null>
  scrollOffsetRef: RefObject<number>
  layoutReadyRef: RefObject<boolean>
  handleContentSizeChange: (ref: RefObject<ScrollView | null>, height: number) => void
  handleIntrinsicContentHeightChange: (height: number) => void
  handleChatListScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleLoadMore?: () => Promise<void> | void
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
    handleScrollEndDrag,
    handleLoadMore,
    hasMore,
    currentSessionId
  } = deps

  const lastContentHeightRef = useRef(0)
  const loadingMoreRef = useRef(false)
  const pendingPrependAnchorRef = useRef<{ prevHeight: number; prevOffsetY: number } | null>(null)

  const handleLoadMoreWithAnchor = useCallback(async () => {
    if (!hasMore || !handleLoadMore || loadingMoreRef.current) return
    loadingMoreRef.current = true
    pendingPrependAnchorRef.current = {
      prevHeight: lastContentHeightRef.current,
      prevOffsetY: Math.max(0, scrollOffsetRef.current)
    }
    try {
      await handleLoadMore()
    } finally {
      loadingMoreRef.current = false
    }
  }, [hasMore, handleLoadMore, scrollOffsetRef])

  const handleListContentSizeChange = useCallback(
    (_width: number, height: number) => {
      const pendingAnchor = pendingPrependAnchorRef.current
      if (height > 0) {
        lastContentHeightRef.current = height
      }
      if (pendingAnchor && height > pendingAnchor.prevHeight + 1) {
        pendingPrependAnchorRef.current = null
        if (pendingAnchor.prevHeight > 0) {
          const deltaHeight = height - pendingAnchor.prevHeight
          const targetOffsetY = Math.max(0, pendingAnchor.prevOffsetY + deltaHeight)
          scrollOffsetRef.current = targetOffsetY
          flatListRef.current?.scrollTo({ y: targetOffsetY, animated: false })
        }
      }
      handleContentSizeChange(flatListRef, height)
    },
    [handleContentSizeChange, flatListRef, scrollOffsetRef]
  )

  const handleListIntrinsicContentHeightChange = useCallback(
    (height: number) => {
      handleIntrinsicContentHeightChange(height)
    },
    [handleIntrinsicContentHeightChange]
  )

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const prevOffsetY = scrollOffsetRef.current
      const nextOffsetY = event.nativeEvent.contentOffset.y
      scrollOffsetRef.current = nextOffsetY
      handleChatListScroll(event)

      if (hasMore && nextOffsetY <= LOAD_EARLIER_TOP_THRESHOLD_PX && prevOffsetY > nextOffsetY) {
        void handleLoadMoreWithAnchor()
      }
    },
    [handleChatListScroll, handleLoadMoreWithAnchor, hasMore, scrollOffsetRef]
  )

  const handleListScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScrollEndDrag?.(event)
      if (hasMore && event.nativeEvent.contentOffset.y <= LOAD_EARLIER_TOP_THRESHOLD_PX) {
        void handleLoadMoreWithAnchor()
      }
    },
    [handleLoadMoreWithAnchor, handleScrollEndDrag, hasMore]
  )

  useEffect(() => {
    layoutReadyRef.current = false
    scrollOffsetRef.current = 0
    lastContentHeightRef.current = 0
    loadingMoreRef.current = false
    pendingPrependAnchorRef.current = null
  }, [currentSessionId, layoutReadyRef, scrollOffsetRef])

  return {
    showLoadMoreBanner: hasMore,
    handleLoadMoreWithAnchor,
    handleListContentSizeChange,
    handleListIntrinsicContentHeightChange,
    handleListScroll,
    handleListScrollEndDrag
  }
}
