import { useRef, useEffect, useCallback, useState } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { type WebSearchConfig } from '@baishou/shared'
import { DEFAULT_WEB_SEARCH_CONFIG } from '@baishou/database'
import { Dimensions, Keyboard, ScrollView } from 'react-native'
import { type InputBarRef } from '@baishou/ui/native'
import { useNativeTheme, useNativeToast } from '@baishou/ui/native'
import { useAgentStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useBaishou } from '../../../providers/BaishouProvider'
import { useAgentUI } from '../../../hooks/useAgentUI'
import { useAgentChatKeyboardInsets } from '../../../hooks/useAgentChatKeyboardInsets'
import { useAgentChatScroll } from '../../../hooks/useAgentChatScroll'
import { usePersistedSharedMemoryLookback } from '../../../hooks/usePersistedSharedMemoryLookback'
import { usePersistedSharedMemoryCopyPrefix } from '../../../hooks/usePersistedSharedMemoryCopyPrefix'
import { useSharedMemoryCopyPreview } from '../../../hooks/useSharedMemoryCopyPreview'
import { INPUT_DOCK_HEIGHT } from '../agent-screen.constants'
import { useAgentBubbleEdit } from './useAgentBubbleEdit'
import { useAgentPendingEmojis } from './useAgentPendingEmojis'
import { useAgentContextDialog } from './useAgentContextDialog'
import { useAgentScreenPreferences } from './useAgentScreenPreferences'
import { useAgentStreamingPresentation } from './useAgentStreamingPresentation'
import { useAgentListScrollHandlers } from './useAgentListScroll'
import { useAgentScreenSession } from './useAgentScreenSession'
import { useAgentScreenChatProfiles } from './useAgentScreenChatProfiles'
import { useAgentScreenInteractions } from './useAgentScreenInteractions'

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
    resolvedChatBackgroundUri,
    chatBackgroundBlur,
    chatBackgroundOverlay,
    hasChatBackground,
    currentAssistant,
    currentProviderId,
    currentModelId,
    displayModelName,
    showAssistantPicker,
    showModelSwitcher,
    setShowAssistantPicker,
    setShowModelSwitcher,
    handleSelectModel,
    hasConfiguredDialogueModel,
    currentProviderType,
    sessions,
    hasMoreSessions,
    isLoadingMoreSessions,
    sessionListScrollKey,
    loadSessions,
    currentSessionId,
    hasMore,
    messages,
    handleLoadMore,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handlePinSession,
    handleRenameSession,
    refreshSessionList,
    pinnedAssistants,
    pickerAssistants,
    handleSelectAssistantWithTracking,
    loadAssistants,
    isStreaming,
    isStreamBridgeActive,
    streamPresentationLinger,
    isRetryActionBusy,
    isCompressing,
    compressionPhase,
    compressionText,
    compressionReasoning,
    compressionTriggerMessageId,
    streamError,
    streamingText,
    streamingReasoning,
    tokenUsage,
    activeTool,
    completedTools,
    pendingEmojis,
    handleSend,
    handleStop,
    handleRegenerate,
    handleResend,
    handleEditMessage,
    handleSaveAssistantEdit,
    handleDeleteMessage,
    activeToolDisplayName,
    composerDraftKey
  } = session

  const {
    showCostDialog,
    showShortcutSheet,
    showRecallSheet,
    recallItems,
    isSearchingRecall,
    setShowCostDialog,
    setShowShortcutSheet,
    setShowRecallSheet,
    handleRecallSearch,
    handleInjectRecall,
    recallSearchMode,
    toggleRecallSearchMode
  } = useAgentUI()

  const { preview: recallCopyPreview, loading: recallCopyPreviewLoading } =
    useSharedMemoryCopyPreview(recallLookbackMonths, showRecallSheet, {
      userCopyPrefix: copyPrefix,
      locale: i18n.language
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
  } = useAgentChatScroll({
    sessionId: currentSessionId,
    messages,
    isStreaming,
    isStreamBridgeActive,
    activeTool
  })

  useEffect(() => {
    bindFlatList(flatListRef)
  }, [bindFlatList])

  // 仅在真正获得焦点时贴底一次。绝不能把 scrollToBottomOnFocus 放进 deps：
  // 托底 minHeight / 跟随状态变化会换掉回调引用，useFocusEffect 会在仍聚焦时反复重跑，
  // 表现为流式中不断 focus_bottom 解锁并拽到底（见滚动诊断日志）。
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

  const {
    contextDialogState,
    setContextDialogState,
    activeContextSessionId,
    contextRecompressJob,
    runContextRecompress,
    dismissContextRecompressError,
    handleShowContext,
    handleRefreshPricing,
    pricingLastUpdated,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadInputTokens,
    totalCacheWriteInputTokens,
    estimatedCost,
    totalCostMicros
  } = useAgentContextDialog({
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
      messages,
      t
    })

  const streaming = useAgentStreamingPresentation({
    currentSessionId,
    messages,
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
    t: tr
  })

  const {
    showLoadMoreBanner,
    handleListContentSizeChange,
    handleListIntrinsicContentHeightChange,
    handleListScroll
  } =
    useAgentListScrollHandlers({
      flatListRef,
      scrollOffsetRef,
      layoutReadyRef,
      handleContentSizeChange,
      handleIntrinsicContentHeightChange,
      handleChatListScroll,
      hasMore,
      currentSessionId
    })

  const {
    shortcuts,
    addShortcut,
    updateShortcut,
    deleteShortcut,
    reorderShortcuts,
    ttsPlayingMsgId,
    handleTtsReadAloud,
    handleInputBarFocus,
    handleSendWithScroll,
    handleShortcutSelect,
    handleBranch
  } = useAgentScreenInteractions({
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
    streamError,
    isStreaming,
    toast
  })

  return {
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
    resolvedChatBackgroundUri,
    chatBackgroundBlur,
    chatBackgroundOverlay,
    userProfile,
    displayModelName,
    currentProviderId,
    currentProviderType,
    totalCostMicros,
    setShowModelSwitcher,
    setShowCostDialog,
    drawerSwipeEnabled,
    streaming,
    handleListScroll,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    handleMomentumScrollBegin,
    handleMomentumScrollEnd,
    handleListContentSizeChange,
    handleListIntrinsicContentHeightChange,
    messages,
    hasMore,
    showLoadMoreBanner,
    handleLoadMore,
    isStreaming,
    isStreamBridgeActive,
    streamingText,
    streamingReasoning,
    chatUserProfile,
    chatAiProfile,
    hasChatBackground,
    compressionPhase,
    compressionTriggerMessageId,
    isCompressing,
    compressionText,
    compressionReasoning,
    lastMessage,
    activeToolDisplayName,
    editingMessageId,
    handleRegenerate,
    handleResend,
    handleEditMessage,
    handleSaveAssistantEdit,
    handleDeleteMessage,
    handleTtsReadAloud,
    ttsPlayingMsgId,
    handleShowContext,
    handleBranch,
    handleBubbleEditingChange,
    isRetryActionBusy,
    showScrollButton,
    isBubbleEditing,
    scrollButtonAnimatedStyle,
    scrollToBottom,
    inputDockHeight,
    setInputDockHeight,
    inputDockAnimatedStyle,
    handleSendWithScroll,
    handleStop,
    hasConfiguredDialogueModel,
    toast,
    composerDraftKey,
    handleInputBarFocus,
    shortcuts,
    assistantDisplayName,
    setShowShortcutSheet,
    setShowRecallSheet,
    ttsMode,
    toggleTtsMode,
    currentAssistant,
    resolvedCurrentAvatarUri,
    pinnedAssistants,
    sessions,
    sessionListScrollKey,
    hasMoreSessions,
    isLoadingMoreSessions,
    loadSessions,
    currentSessionId,
    handleSelectSession,
    handleCreateSession,
    refreshSessionList,
    setShowAssistantPicker,
    handleSelectAssistantWithTracking,
    handlePinSession,
    handleDeleteSession,
    handleRenameSession,
    showAssistantPicker,
    showModelSwitcher,
    handleSelectModel,
    currentModelId,
    showCostDialog,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadInputTokens,
    totalCacheWriteInputTokens,
    estimatedCost,
    pricingLastUpdated,
    handleRefreshPricing,
    showShortcutSheet,
    handleShortcutSelect,
    addShortcut,
    updateShortcut,
    deleteShortcut,
    reorderShortcuts,
    showRecallSheet,
    recallItems,
    isSearchingRecall,
    handleRecallSearch,
    handleInjectRecall,
    recallSearchMode,
    toggleRecallSearchMode,
    recallLookbackMonths,
    setRecallLookbackMonths,
    services,
    copyPrefix,
    setCopyPrefix,
    recallCopyPreview,
    recallCopyPreviewLoading,
    contextDialogState,
    setContextDialogState,
    activeContextSessionId,
    contextRecompressJob,
    runContextRecompress,
    dismissContextRecompressError,
    loadAssistants,
    pickerAssistants
  }
}
