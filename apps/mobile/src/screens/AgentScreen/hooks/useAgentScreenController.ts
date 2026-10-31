import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { type WebSearchConfig } from '@baishou/shared'
import { DEFAULT_WEB_SEARCH_CONFIG } from '@baishou/database'
import { Dimensions, Keyboard, ScrollView } from 'react-native'
import {
  type InputBarRef,
  type RecallItem,
  useNativeTheme,
  useNativeToast
} from '@baishou/ui/native'
import { useAgentStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useBaishou } from '../../../providers/BaishouProvider'
import { useAgentUI } from '../../../hooks/useAgentUI'
import { useAgentChatKeyboardInsets } from '../../../hooks/useAgentChatKeyboardInsets'
import { useAgentChatScroll } from '../../../hooks/useAgentChatScroll'
import { useMobilePendingQueue } from '../../../hooks/useMobilePendingQueue'
import { usePersistedSharedMemoryLookback } from '../../../hooks/usePersistedSharedMemoryLookback'
import { usePersistedSharedMemoryCopyPrefix } from '../../../hooks/usePersistedSharedMemoryCopyPrefix'
import { useSharedMemoryCopyPreview } from '../../../hooks/useSharedMemoryCopyPreview'
import { INPUT_DOCK_HEIGHT } from '../agent-screen.constants'
import { excludePendingQueuedUserMessages } from '../components/MobileComposerRuntimeQueueBar'
import { useAgentBubbleEdit } from './useAgentBubbleEdit'
import { useAgentPendingEmojis } from './useAgentPendingEmojis'
import { useAgentContextDialog } from './useAgentContextDialog'
import { useAgentScreenPreferences } from './useAgentScreenPreferences'
import { useAgentStreamingPresentation } from './useAgentStreamingPresentation'
import { useAgentListScrollHandlers } from './useAgentListScroll'
import { useAgentScreenSession } from './useAgentScreenSession'
import { useAgentScreenChatProfiles } from './useAgentScreenChatProfiles'
import { useAgentScreenInteractions } from './useAgentScreenInteractions'
import { formatRecallInjection } from '../utils/format-recall-injection'

export function useAgentScreenController() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const tr = useCallback(
    (key: string, fallback?: string) => String(t(key, { defaultValue: fallback ?? key })),
    [t]
  )
  const { isLoading, searchMode, toggleSearchMode } = useAgentStore()
  const { colors, isDark } = useNativeTheme()
  const tabBarHeight = useBottomTabBarHeight()
  const [isBubbleEditing, setIsBubbleEditing] = useState(false)
  const { lookbackMonths: recallLookbackMonths, setLookbackMonths: setRecallLookbackMonths } =
    usePersistedSharedMemoryLookback()
  const { copyPrefix, setCopyPrefix } = usePersistedSharedMemoryCopyPrefix()
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [inputDockHeight, setInputDockHeight] = useState(INPUT_DOCK_HEIGHT)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [webSearchEngine, setWebSearchEngine] = useState<WebSearchConfig['webSearchEngine']>(
    DEFAULT_WEB_SEARCH_CONFIG.webSearchEngine
  )

  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()
  const flatListRef = useRef<ScrollView>(null)
  const inputBarRef = useRef<InputBarRef>(null)
  const scrollOffsetRef = useRef(0)
  const layoutReadyRef = useRef(false)
  const [listViewportHeight, setListViewportHeight] = useState(0)

  const session = useAgentScreenSession({
    drawerOpen,
    tr,
    webSearchEngine,
    setWebSearchEngine
  })

  const {
    userProfile,
    resolvedCurrentAvatarUri,
    resolvedUserAvatarUri,
    hasChatBackground,
    currentAssistant,
    currentSessionId,
    hasMore,
    messages,
    handleLoadMore,
    handleSelectSession,
    refreshSessionList,
    isStreaming,
    isStreamBridgeActive,
    streamPresentationLinger,
    isCompressing,
    compressionPhase,
    compressionText,
    compressionReasoning,
    compressionTriggerMessageId,
    streamError,
    streamingText,
    streamingReasoning,
    timeline,
    tokenUsage,
    activeTool,
    completedTools,
    pendingEmojis,
    handleSend,
    steerPendingInput,
    refreshSessionMessages,
    activeToolDisplayName
  } = session

  const pendingQueueCtl = useMobilePendingQueue({
    sessionId: currentSessionId,
    refreshSessionMessages,
    onSteerSendNow: steerPendingInput
  })

  const displayMessages = useMemo(
    () => excludePendingQueuedUserMessages(messages, pendingQueueCtl.pendingQueue),
    [messages, pendingQueueCtl.pendingQueue]
  )

  const ui = useAgentUI()
  const {
    showCostDialog,
    showShortcutSheet,
    showRecallSheet,
    setShowCostDialog,
    setShowShortcutSheet,
    setShowRecallSheet,
    handleInjectRecall
  } = ui

  const injectRecallIntoComposer = useCallback(
    (items: RecallItem[]) => {
      handleInjectRecall(items)
      const text = formatRecallInjection(items)
      if (!text) return
      inputBarRef.current?.insertText(text)
    },
    [handleInjectRecall]
  )

  const { preview: recallCopyPreview, loading: recallCopyPreviewLoading } =
    useSharedMemoryCopyPreview(recallLookbackMonths, showRecallSheet, {
      userCopyPrefix: copyPrefix,
      locale: i18n.language
    })

  const scroll = useAgentChatScroll({
    sessionId: currentSessionId,
    messages: displayMessages,
    isStreaming,
    isStreamBridgeActive: isStreamBridgeActive || streamPresentationLinger,
    activeTool,
    viewportHeight: listViewportHeight
  })
  const {
    showScrollButton,
    handleListScroll: handleChatListScroll,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    handleMomentumScrollBegin,
    handleMomentumScrollEnd,
    scrollToBottom,
    scrollToBottomOnFocus,
    beginFollowIfAtBottom,
    handleContentSizeChange,
    handleIntrinsicContentHeightChange,
    contentAnchorMinHeight,
    beginContentHandoff,
    finalizeContentHandoff,
    bindFlatList
  } = scroll

  useEffect(() => {
    bindFlatList(flatListRef)
  }, [bindFlatList])

  const scrollToBottomOnFocusRef = useRef(scrollToBottomOnFocus)
  scrollToBottomOnFocusRef.current = scrollToBottomOnFocus
  useFocusEffect(
    useCallback(() => {
      scrollToBottomOnFocusRef.current()
    }, [])
  )

  const composerKeyboardLiftEnabled = !drawerOpen && !showShortcutSheet && !showRecallSheet
  const {
    keyboardInset,
    inputDockAnimatedStyle,
    scrollButtonAnimatedStyle,
    listSpacerAnimatedStyle,
    handleComposerFocus,
    resetKeyboardInset
  } = useAgentChatKeyboardInsets({
    tabBarHeight,
    inputDockHeight,
    isBubbleEditing,
    enableComposerKeyboardLift: composerKeyboardLiftEnabled
  })

  const readKeyboardInset = useCallback(() => {
    const windowHeight = Dimensions.get('window').height
    const metrics = Keyboard.metrics()
    if (!metrics) return keyboardInset
    const rawHeight =
      metrics.height > 0 ? metrics.height : metrics.screenY > 0 ? windowHeight - metrics.screenY : 0
    return Math.max(0, Math.ceil(rawHeight) - tabBarHeight)
  }, [keyboardInset, tabBarHeight])

  const drawerSwipeEnabled =
    !drawerOpen && !isBubbleEditing && !showShortcutSheet && !showRecallSheet

  const { editingRowRef, handleBubbleEditingChange } = useAgentBubbleEdit({
    flatListRef,
    scrollOffsetRef,
    readKeyboardInset,
    tabBarHeight,
    inputDockHeight,
    resetKeyboardInset,
    isBubbleEditing,
    editingMessageId,
    setIsBubbleEditing,
    setEditingMessageId
  })

  const { pendingEmojiAttachments } = useAgentPendingEmojis(
    services,
    currentAssistant,
    pendingEmojis
  )

  const { ttsMode, toggleTtsMode } = useAgentScreenPreferences()

  const ctxDialog = useAgentContextDialog({
    currentSessionId,
    services,
    searchMode,
    toast,
    t: tr,
    isCompressing,
    compressionPhase,
    compressionText,
    compressionReasoning,
    tokenUsage,
    showCostDialog,
    dbReady
  })

  const { assistantDisplayName, chatAiProfile, chatUserProfile, lastMessage } =
    useAgentScreenChatProfiles({
      currentAssistant,
      resolvedCurrentAvatarUri,
      resolvedUserAvatarUri,
      userProfile,
      messages: displayMessages,
      t
    })

  const streaming = useAgentStreamingPresentation({
    currentSessionId,
    messages: displayMessages,
    scrollOffsetRef,
    isStreaming,
    isStreamBridgeActive,
    streamPresentationLinger,
    isCompressing,
    compressionPhase,
    compressionText,
    compressionReasoning,
    compressionTriggerMessageId,
    streamingText,
    streamingReasoning,
    timeline,
    activeTool,
    completedTools,
    activeToolDisplayName,
    pendingEmojiAttachments,
    chatAiProfile,
    hasChatBackground,
    beginContentHandoff,
    finalizeContentHandoff,
    listViewportHeight,
    contentAnchorMinHeight,
    listSpacerAnimatedStyle,
    colors,
    t: tr,
    streamError
  })

  const listScroll = useAgentListScrollHandlers({
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
  })

  const interactions = useAgentScreenInteractions({
    drawerOpen,
    showShortcutSheet,
    showRecallSheet,
    resetKeyboardInset,
    inputBarRef,
    flatListRef,
    handleComposerFocus,
    beginFollowIfAtBottom,
    handleSend,
    setShowShortcutSheet,
    currentSessionId,
    currentAssistantName: currentAssistant?.name,
    refreshSessionList,
    handleSelectSession,
    streamError,
    isStreaming,
    toast
  })

  return {
    ...session,
    ...ui,
    ...ctxDialog,
    ...interactions,
    router,
    t: tr,
    i18n,
    isLoading,
    searchMode,
    toggleSearchMode,
    colors,
    isDark,
    drawerOpen,
    setDrawerOpen,
    flatListRef,
    inputBarRef,
    editingRowRef,
    layoutReadyRef,
    listViewportHeight,
    setListViewportHeight,
    setShowCostDialog,
    drawerSwipeEnabled,
    streaming,
    handleListScroll: listScroll.handleListScroll,
    handleScrollBeginDrag,
    handleScrollEndDrag: listScroll.handleListScrollEndDrag,
    handleMomentumScrollBegin,
    handleMomentumScrollEnd,
    handleListContentSizeChange: listScroll.handleListContentSizeChange,
    handleListIntrinsicContentHeightChange: listScroll.handleListIntrinsicContentHeightChange,
    messages: displayMessages,
    pendingQueueCtl,
    showLoadMoreBanner: listScroll.showLoadMoreBanner,
    handleLoadMore: listScroll.handleLoadMoreWithAnchor,
    chatUserProfile,
    chatAiProfile,
    lastMessage,
    editingMessageId,
    handleBubbleEditingChange,
    showScrollButton,
    isBubbleEditing,
    scrollButtonAnimatedStyle,
    scrollToBottom,
    inputDockHeight,
    setInputDockHeight,
    inputDockAnimatedStyle,
    toast,
    assistantDisplayName,
    setShowShortcutSheet,
    setShowRecallSheet,
    ttsMode,
    toggleTtsMode,
    handleInjectRecall: injectRecallIntoComposer,
    recallLookbackMonths,
    setRecallLookbackMonths,
    services,
    copyPrefix,
    setCopyPrefix,
    recallCopyPreview,
    recallCopyPreviewLoading
  }
}
