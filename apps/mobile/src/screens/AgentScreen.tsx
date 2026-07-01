import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, type Href } from 'expo-router'
import {
  type PromptShortcut,
  type WebSearchConfig,
  LATTE_ASSISTANT_NAME,
  normalizeChatBackgroundBlur,
  normalizeChatBackgroundOverlayOpacity
} from '@baishou/shared'
import { DEFAULT_WEB_SEARCH_CONFIG } from '@baishou/database'
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Text,
  Alert,
  Pressable,
  Platform,
  Dimensions,
  Keyboard,
  ImageBackground,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Clipboard from 'expo-clipboard'
import { MaterialIcons } from '@expo/vector-icons'
import {
  InputBar,
  type InputBarRef,
  StreamingBubble,
  RecallDialog,
  ChatCostDialog,
  PromptShortcutSheet,
  resolveActiveToolDisplayName
} from '@baishou/ui/native'
import { useNativeTheme, useNativeToast } from '@baishou/ui/native'
import { useAgentStore, useAgentNavigationStore, useContextCompressionStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import Animated from 'react-native-reanimated'

import { AgentChatAppBar } from '../components/AgentChatAppBar'
import { AgentMessageRow } from '../components/AgentMessageRow'
import { ScreenSafeArea } from '../components/ScreenSafeArea'
import { AgentDrawer, type AssistantSummary } from '../components/AgentDrawer'
import { AgentDrawerSwipeZone } from '../components/AgentDrawerSwipeZone'
import { AssistantPicker } from '../components/AssistantPicker'
import { ModelSwitcher } from '../components/ModelSwitcher'
import { ContextChainDialog } from '../components/ContextChainDialog'
import { useBaishou } from '../providers/BaishouProvider'
import { useAgentSession } from '../hooks/useAgentSession'
import { useAgentSessions } from '../hooks/useAgentSessions'
import { useAgentStream } from '../hooks/useAgentStream'
import { useAgentModel } from '../hooks/useAgentModel'
import { useAgentUI } from '../hooks/useAgentUI'
import { useTTS } from '../hooks/useTTS'
import { useBranchSession } from '../hooks/useBranchSession'
import { useStreamError } from '../hooks/useStreamError'
import { useMobilePromptShortcuts } from '../hooks/useMobilePromptShortcuts'
import { useResolvedAssistantAvatar } from '../hooks/useResolvedAssistantAvatar'
import { useResolvedUserAvatar } from '../hooks/useResolvedUserAvatar'
import { useResolvedChatBackground } from '../hooks/useResolvedChatBackground'
import { useAgentUserProfile } from '../hooks/useAgentUserProfile'
import { useAgentChatKeyboardInsets } from '../hooks/useAgentChatKeyboardInsets'
import { useAgentChatScroll } from '../hooks/useAgentChatScroll'
import {
  logAgentScrollEvent,
  logAgentUiEvent,
  setAgentScrollDebugContext
} from '../utils/agent-scroll-diagnostics'
import { useAgentNavigationPersistence } from '../hooks/useAgentNavigationPersistence'
import {
  hydrateAssistantsForUi,
  mapAssistantRowsToUiWithCachedAvatars,
  type MobileAssistantUi
} from '../lib/mobile-assistant.util'
import { writeAgentNavigationSnapshot } from '../lib/agent-navigation-persistence'
import { consumeAssistantsNeedRefresh } from '../lib/assistant-ui-refresh-signal'
import { waitForVaultEcosystemResync } from '../services/mobile-vault-resync.service'
import { useAgentComposerDraftKey } from '../hooks/useAgentComposerDraftKey'
import { mobileComposerDraftStorage } from '../lib/mobile-composer-draft.storage'
import { useThrottledFocusRefresh } from '../hooks/useThrottledFocusRefresh'

/** 底部输入栏 + 工具条的大致高度，用于「回到底部」悬浮按钮定位 */
const INPUT_DOCK_HEIGHT = 136
/** 编辑态：保存按钮与 token 行距键盘顶部的留白 */
const BUBBLE_EDIT_KEYBOARD_BUFFER = 72
/** 编辑态且键盘收起时：保存/token 与底部工具栏之间的额外间距 */
const BUBBLE_EDIT_DOCK_GAP = 16

const IDLE_LIVE_COMPRESSION = {
  phase: 'auto' as const,
  summary: '',
  reasoning: '',
  isActive: false
}

/** 列表内流式助手气泡的稳定 key，落库前后保持同一挂载点 */
const LIVE_ASSISTANT_STREAM_KEY = 'live-assistant-stream'
/** linger 结束后再保留 live 展示，等布局稳定后再释放 minHeight */
const HOLD_LIVE_PRESENTATION_MS = 320

export const AgentScreen = () => {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { isLoading, searchMode, toggleSearchMode, clearSession } = useAgentStore()
  const { colors, isDark } = useNativeTheme()
  const tabBarHeight = useBottomTabBarHeight()
  const [isBubbleEditing, setIsBubbleEditing] = useState(false)
  const [recallLookbackMonths, setRecallLookbackMonths] = useState(1)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [inputDockHeight, setInputDockHeight] = useState(INPUT_DOCK_HEIGHT)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [holdLivePresentation, setHoldLivePresentation] = useState(false)
  const [keepLiveRowAfterHold, setKeepLiveRowAfterHold] = useState(false)
  const [webSearchEngine, setWebSearchEngine] = useState<WebSearchConfig['webSearchEngine']>(
    DEFAULT_WEB_SEARCH_CONFIG.webSearchEngine
  )

  const handleBubbleEditingChange = useCallback((editing: boolean, messageId?: string) => {
    setIsBubbleEditing(editing)
    setEditingMessageId(editing && messageId ? messageId : null)
  }, [])

  const toast = useNativeToast()
  const {
    services,
    dbReady,
    vaultRevision,
    vaultSwitching,
    storageIndexing,
    ecosystemResyncEpoch
  } = useBaishou()
  const flatListRef = useRef<ScrollView>(null)
  const inputBarRef = useRef<InputBarRef>(null)
  const editingRowRef = useRef<View>(null)
  const scrollOffsetRef = useRef(0)
  const layoutReadyRef = useRef(false)
  const bubbleEditScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentSessionIdRef = useRef<string | null>(null)

  const [assistants, setAssistants] = useState<MobileAssistantUi[]>([])
  const userProfile = useAgentUserProfile()

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const saved =
        (await services.settingsManager.get<WebSearchConfig>('web_search_config')) ??
        DEFAULT_WEB_SEARCH_CONFIG
      setWebSearchEngine(saved.webSearchEngine ?? DEFAULT_WEB_SEARCH_CONFIG.webSearchEngine)
    })()
  }, [dbReady, services])

  const {
    currentAssistant,
    currentProviderId,
    currentModelId,
    displayModelName,
    showAssistantPicker,
    showModelSwitcher,
    setShowAssistantPicker,
    setShowModelSwitcher,
    handleSelectAssistant,
    handleSelectModel,
    setCurrentAssistant,
    syncWithSession,
    hasConfiguredDialogueModel
  } = useAgentModel({ currentSessionIdRef })

  const { sessions, hasMoreSessions, isLoadingMoreSessions, sessionListScrollKey, loadSessions } =
    useAgentSessions(currentAssistant?.id)

  const resolvedCurrentAvatarUri = useResolvedAssistantAvatar(currentAssistant?.avatarPath)
  const resolvedUserAvatarUri = useResolvedUserAvatar(userProfile.avatarPath)
  const resolvedChatBackgroundUri = useResolvedChatBackground(userProfile.chatBackgroundPath)
  const chatBackgroundBlur = normalizeChatBackgroundBlur(userProfile.chatBackgroundBlur)
  const chatBackgroundOverlay = normalizeChatBackgroundOverlayOpacity(
    userProfile.chatBackgroundOverlayOpacity
  )
  const hasChatBackground = Boolean(resolvedChatBackgroundUri)

  const {
    currentSessionId,
    setCurrentSessionId,
    hasMore,
    messages,
    refreshSessionMessages,
    bumpReloadEpoch,
    handleLoadMore,
    handleSelectSession,
    handleAssistantSwitched,
    handleCreateSession,
    handleDeleteSession,
    handlePinSession,
    handleRenameSession
  } = useAgentSession({
    assistantId: currentAssistant?.id,
    providerId: currentProviderId ?? undefined,
    modelId: currentModelId ?? undefined
  })

  currentSessionIdRef.current = currentSessionId

  const composerDraftKey = useAgentComposerDraftKey(currentSessionId)

  useEffect(() => {
    void syncWithSession(currentSessionId)
  }, [currentSessionId, syncWithSession])

  const refreshSessionList = useCallback(() => {
    void loadSessions(true, currentAssistant?.id)
  }, [loadSessions, currentAssistant?.id])

  useEffect(() => {
    if (!drawerOpen || !dbReady || !currentAssistant?.id) return
    const timer = setTimeout(() => {
      void loadSessions(true, currentAssistant.id)
    }, 280)
    return () => clearTimeout(timer)
  }, [drawerOpen, dbReady, currentAssistant?.id, loadSessions])

  useAgentNavigationPersistence({
    dbReady,
    vaultSwitching,
    vaultRevision,
    services,
    assistants,
    currentAssistant,
    currentSessionId,
    handleSelectAssistant,
    handleSelectSession,
    loadSessions,
    clearSession
  })

  const {
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
    handleSend,
    handleStop,
    handleRegenerate,
    handleResend,
    handleEditMessage,
    handleSaveAssistantEdit,
    handleDeleteMessage
  } = useAgentStream(
    currentSessionId,
    currentProviderId,
    currentModelId,
    currentAssistant,
    setCurrentSessionId,
    refreshSessionList,
    searchMode,
    refreshSessionMessages,
    bumpReloadEpoch
  )

  const activeToolDisplayName = useMemo(
    () => resolveActiveToolDisplayName(activeTool, t, webSearchEngine),
    [activeTool, t, webSearchEngine]
  )

  const [showLoadMoreBanner, setShowLoadMoreBanner] = useState(false)
  const loadMoreLockRef = useRef(false)

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

  const {
    showScrollButton,
    handleListScroll: handleChatListScroll,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    handleMomentumScrollBegin,
    handleMomentumScrollEnd,
    scrollToBottom,
    beginFollowIfAtBottom,
    handleContentSizeChange,
    contentAnchorMinHeight,
    beginContentHandoff,
    releaseContentHandoff,
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

  const composerKeyboardLiftEnabled = !drawerOpen && !showShortcutSheet && !showRecallSheet
  const drawerSwipeEnabled =
    !drawerOpen && !isBubbleEditing && !showShortcutSheet && !showRecallSheet
  const {
    keyboardInset,
    inputDockAnimatedStyle,
    scrollButtonAnimatedStyle,
    listSpacerAnimatedStyle,
    listBottomPadding,
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

  /** 按行实测位置微调滚动：键盘展开时避开键盘，收起时避开底部工具栏 */
  const scrollEditingMessageIntoView = useCallback(() => {
    if (!editingMessageId) return
    const row = editingRowRef.current
    if (!row) return

    row.measureInWindow((_x, y, _w, height) => {
      const windowHeight = Dimensions.get('window').height
      const effectiveKeyboardInset = readKeyboardInset()
      const keyboardOpen = effectiveKeyboardInset >= 60
      const safeBottom = keyboardOpen
        ? windowHeight - effectiveKeyboardInset - tabBarHeight - BUBBLE_EDIT_KEYBOARD_BUFFER
        : windowHeight - tabBarHeight - inputDockHeight - BUBBLE_EDIT_DOCK_GAP
      const rowBottom = y + height
      if (rowBottom <= safeBottom + 4) return

      flatListRef.current?.scrollTo({
        y: scrollOffsetRef.current + (rowBottom - safeBottom),
        animated: true
      })
    })
  }, [editingMessageId, readKeyboardInset, tabBarHeight, inputDockHeight])

  const scheduleBubbleEditScroll = useCallback(() => {
    if (!editingMessageId) return
    if (bubbleEditScrollTimerRef.current) clearTimeout(bubbleEditScrollTimerRef.current)
    bubbleEditScrollTimerRef.current = setTimeout(
      () => {
        bubbleEditScrollTimerRef.current = null
        scrollEditingMessageIntoView()
      },
      Platform.OS === 'ios' ? 120 : 220
    )
  }, [editingMessageId, scrollEditingMessageIntoView])

  useEffect(() => {
    if (!isBubbleEditing) {
      if (bubbleEditScrollTimerRef.current) {
        clearTimeout(bubbleEditScrollTimerRef.current)
        bubbleEditScrollTimerRef.current = null
      }
      return
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const sub = Keyboard.addListener(showEvent, scheduleBubbleEditScroll)
    return () => sub.remove()
  }, [isBubbleEditing, scheduleBubbleEditScroll])

  useEffect(() => {
    if (!isBubbleEditing || !editingMessageId) return
    scheduleBubbleEditScroll()
  }, [isBubbleEditing, editingMessageId, listBottomPadding, scheduleBubbleEditScroll])

  const handleInputBarFocus = useCallback(() => {
    handleComposerFocus()
    requestAnimationFrame(() => scrollToBottom(flatListRef, false))
  }, [handleComposerFocus, scrollToBottom])

  const handleSendWithScroll = useCallback(
    async (text: string, attachments?: unknown[], sendSearchMode?: boolean) => {
      beginFollowIfAtBottom(flatListRef)
      return handleSend(text, attachments, sendSearchMode)
    },
    [beginFollowIfAtBottom, handleSend]
  )

  useEffect(() => {
    const overlaysOpen = drawerOpen || showShortcutSheet || showRecallSheet
    if (!overlaysOpen) return
    resetKeyboardInset()
    inputBarRef.current?.blur()
    const frame = requestAnimationFrame(() => {
      Keyboard.dismiss()
    })
    return () => cancelAnimationFrame(frame)
  }, [drawerOpen, showShortcutSheet, showRecallSheet, resetKeyboardInset])

  const { shortcuts, addShortcut, updateShortcut, deleteShortcut, reorderShortcuts } =
    useMobilePromptShortcuts()

  const handleListContentSizeChange = useCallback(
    (_width: number, height: number) => {
      handleContentSizeChange(flatListRef, height)
    },
    [handleContentSizeChange]
  )

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y
      handleChatListScroll(event)

      const nearTop = event.nativeEvent.contentOffset.y < 100
      const nextShowLoadMore = hasMore && nearTop
      setShowLoadMoreBanner((prev) => (prev === nextShowLoadMore ? prev : nextShowLoadMore))
    },
    [handleChatListScroll, hasMore]
  )

  useEffect(() => {
    layoutReadyRef.current = false
  }, [currentSessionId])

  useEffect(() => {
    if (!hasMore) {
      setShowLoadMoreBanner(false)
    }
  }, [hasMore])

  const { ttsPlayingMsgId, handleTtsReadAloud } = useTTS()
  const { branchSession } = useBranchSession()
  useStreamError(streamError, isStreaming)

  const loadAssistantsRequestRef = useRef(0)

  useEffect(() => {
    if (vaultSwitching) {
      loadAssistantsRequestRef.current += 1
      setAssistants([])
    }
  }, [vaultSwitching])

  const loadAssistants = useCallback(async () => {
    if (!dbReady || !services) return
    if (storageIndexing) {
      await waitForVaultEcosystemResync()
    }
    const requestId = ++loadAssistantsRequestRef.current
    try {
      const rows = await services.assistantManager.findAll()
      if (requestId !== loadAssistantsRequestRef.current) return
      setAssistants(mapAssistantRowsToUiWithCachedAvatars(rows, { preferFileUri: true }))

      const hydrated = await hydrateAssistantsForUi(
        rows,
        services.attachmentManager,
        services.fileSystem,
        { preferFileUri: true }
      )
      if (requestId !== loadAssistantsRequestRef.current) return
      setAssistants(hydrated)
    } catch {
      if (requestId !== loadAssistantsRequestRef.current) return
      setAssistants([])
    }
  }, [dbReady, services, storageIndexing, vaultRevision, ecosystemResyncEpoch])

  const refreshAssistantsOnFocus = useCallback(() => {
    void loadAssistants()
  }, [loadAssistants])

  useEffect(() => {
    void loadAssistants()
  }, [loadAssistants])

  useThrottledFocusRefresh(refreshAssistantsOnFocus, 2000, consumeAssistantsNeedRefresh)

  // 伙伴头像/名称变更后同步 currentAssistant，避免聊天界面仍展示旧数据
  useEffect(() => {
    if (!currentAssistant?.id) return
    const updated = assistants.find((a) => a.id === currentAssistant.id)
    if (!updated) return
    if (
      updated.avatarPath !== currentAssistant.avatarPath ||
      updated.displayAvatarUri !== currentAssistant.displayAvatarUri ||
      updated.name !== currentAssistant.name ||
      updated.emoji !== currentAssistant.emoji
    ) {
      setCurrentAssistant(updated)
    }
  }, [assistants, currentAssistant, setCurrentAssistant])

  const pinnedAssistants = useMemo(
    () =>
      assistants
        .filter((a) => a.isPinned)
        .slice(0, 3)
        .map(({ id, name, description, emoji, avatarPath, displayAvatarUri, assistantKind }) => ({
          id,
          name,
          description,
          emoji,
          avatarPath,
          displayAvatarUri,
          assistantKind
        })),
    [assistants]
  )

  const pickerAssistants = useMemo(
    () =>
      assistants.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description || '',
        emoji: a.emoji,
        avatarPath: a.avatarPath,
        displayAvatarUri: a.displayAvatarUri,
        systemPrompt: a.systemPrompt,
        providerId: a.providerId,
        modelId: a.modelId,
        assistantKind: a.assistantKind
      })),
    [assistants]
  )

  const handleSelectAssistantWithTracking = useCallback(
    async (assistant: AssistantSummary) => {
      const full = assistants.find((a) => a.id === assistant.id)
      if (!full) return

      if (dbReady && services) {
        try {
          const vaultKey = await services.pathService.getActiveVaultNameForContext()
          const snapshot = { assistantId: assistant.id, sessionId: null }
          useAgentNavigationStore.getState().setContext(vaultKey, snapshot)
          await writeAgentNavigationSnapshot(vaultKey, snapshot)
        } catch (e) {
          console.warn('Failed to persist assistant navigation snapshot', e)
        }
      }

      handleSelectAssistant(full as any)
      const fullWithModel = full as {
        providerId?: string
        modelId?: string
      }
      await handleAssistantSwitched(assistant.id, fullWithModel.providerId, fullWithModel.modelId)

      if (dbReady && services) {
        try {
          const [recentSessions] = await Promise.all([
            services.sessionManager.list(1, 0, assistant.id),
            loadSessions(true, assistant.id)
          ])
          if (recentSessions?.length > 0) {
            await handleSelectSession(recentSessions[0]!.id)
          }
        } catch (e) {
          console.warn('Failed to open recent session for assistant', e)
        }
      }

      void loadAssistants()
    },
    [
      assistants,
      handleSelectAssistant,
      handleAssistantSwitched,
      handleSelectSession,
      services,
      dbReady,
      loadSessions,
      loadAssistants
    ]
  )

  const handleShortcutSelect = useCallback(
    (shortcut: PromptShortcut) => {
      setShowShortcutSheet(false)
      if (shortcut.content.trim()) {
        inputBarRef.current?.insertShortcutContent(shortcut.content.trim())
      }
    },
    [setShowShortcutSheet]
  )

  const [ttsMode, setTtsMode] = useState<'manual' | 'always'>(() => 'manual')
  const ttsModeRef = useRef(ttsMode)
  ttsModeRef.current = ttsMode

  const toggleTtsMode = useCallback(() => {
    setTtsMode((prev) => {
      const next = prev === 'manual' ? 'always' : 'manual'
      AsyncStorage.setItem('baishou_tts_mode', next).catch(() => {})
      return next
    })
  }, [])

  useEffect(() => {
    AsyncStorage.getItem('baishou_tts_mode')
      .then((v) => {
        if (v === 'always') {
          setTtsMode('always')
        } else if (v === 'off' || v === 'manual') {
          setTtsMode('manual')
          if (v === 'off') {
            AsyncStorage.setItem('baishou_tts_mode', 'manual').catch(() => {})
          }
        }
      })
      .catch(() => {})
  }, [])

  const searchModeLoadedRef = useRef(false)
  useEffect(() => {
    AsyncStorage.getItem('baishou_search_mode')
      .then((v) => {
        if (v === 'true' && !searchMode) {
          useAgentStore.getState().toggleSearchMode?.()
        }
        searchModeLoadedRef.current = true
      })
      .catch(() => {
        searchModeLoadedRef.current = true
      })
  }, [])

  useEffect(() => {
    if (!searchModeLoadedRef.current) return
    AsyncStorage.setItem('baishou_search_mode', String(searchMode)).catch(() => {})
  }, [searchMode])

  const chatMessagesRef = useRef<any[]>([])
  chatMessagesRef.current = messages
  const prevIsStreamingRef = useRef(isStreaming)
  useEffect(() => {
    if (prevIsStreamingRef.current && !isStreaming) {
      refreshSessionList()
      if (ttsModeRef.current === 'always' && chatMessagesRef.current.length > 0) {
        const lastMsg = chatMessagesRef.current[chatMessagesRef.current.length - 1]
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
          handleTtsReadAloud(lastMsg.content, lastMsg.id)
        }
      }
    }
    prevIsStreamingRef.current = isStreaming
  }, [isStreaming, refreshSessionList, handleTtsReadAloud])

  const [contextDialogState, setContextDialogState] = useState<{
    visible: boolean
    sessionId?: string
    message: any
    flatEntries: any[]
    meta?: any
    compressedContent?: string
    systemPrompt?: string
  }>({
    visible: false,
    message: {},
    flatEntries: []
  })

  const activeContextSessionId = contextDialogState.sessionId ?? currentSessionId ?? undefined
  const contextRecompressJob = useContextCompressionStore((s) =>
    activeContextSessionId ? s.jobs[activeContextSessionId] : undefined
  )
  const storeRunRecompress = useContextCompressionStore((s) => s.runRecompress)
  const storeClearRecompressError = useContextCompressionStore((s) => s.clearError)

  const runContextRecompress = useCallback(
    async (targetSessionId: string) => {
      if (!targetSessionId) return
      const result = await storeRunRecompress(targetSessionId)
      if (result?.ok && result.summaryText) {
        setContextDialogState((prev) => ({
          ...prev,
          compressedContent: result.summaryText,
          flatEntries: prev.flatEntries?.map((entry: { kind?: string; summaryText?: string }) =>
            entry.kind === 'compression-summary'
              ? { ...entry, summaryText: result.summaryText }
              : entry
          )
        }))
      }
    },
    [storeRunRecompress]
  )

  const dismissContextRecompressError = useCallback(() => {
    if (activeContextSessionId) storeClearRecompressError(activeContextSessionId)
  }, [activeContextSessionId, storeClearRecompressError])

  useEffect(() => {
    if (!contextDialogState.visible || !isCompressing || compressionPhase !== 'manual') return
    if (!compressionText.trim() && !compressionReasoning.trim()) return
    setContextDialogState((prev) => ({
      ...prev,
      compressedContent: compressionText || prev.compressedContent,
      flatEntries: prev.flatEntries?.map((entry: { kind?: string; summaryText?: string }) =>
        entry.kind === 'compression-summary' && compressionText
          ? { ...entry, summaryText: compressionText }
          : entry
      )
    }))
  }, [
    contextDialogState.visible,
    isCompressing,
    compressionPhase,
    compressionText,
    compressionReasoning
  ])

  const handleBranch = useCallback(
    async (messageId: string) => {
      if (!currentSessionId) return
      try {
        const newSessionId = await branchSession(
          currentSessionId,
          messageId,
          currentAssistant?.name
        )
        if (newSessionId) {
          toast.showSuccess(t('agent.chat.branch_success', '分支创建成功'))
        }
      } catch (e: any) {
        toast.showError(e.message || t('app.unknown_error', '未知网络或系统错误'))
      }
    },
    [currentSessionId, branchSession, currentAssistant?.name, t]
  )

  const handleShowContext = useCallback(
    async (message: any) => {
      if (!currentSessionId || !services?.getContextAtMessage) return
      try {
        const { result, flatEntries } = await services.getContextAtMessage(
          currentSessionId,
          message.id,
          searchMode
        )
        const vm = result.viewModel
        setContextDialogState({
          visible: true,
          sessionId: currentSessionId ?? undefined,
          message: {
            ...message,
            inputTokens: message.inputTokens,
            outputTokens: message.outputTokens,
            cacheReadInputTokens: message.cacheReadInputTokens,
            cacheWriteInputTokens: message.cacheWriteInputTokens,
            costMicros: message.costMicros
          },
          flatEntries,
          meta: {
            nextRequest: vm?.nextRequest,
            roundUsage: vm?.roundUsage,
            activeRoundIndex: vm?.activeRoundIndex
          },
          compressedContent: result.compressedContent,
          systemPrompt: result.systemPrompt
        })
      } catch (e) {
        console.error('[AgentScreen] Failed to load context at message:', e)
        toast.showError(t('agent.chat.context_load_failed', '加载调用链失败'))
      }
    },
    [currentSessionId, services, searchMode, toast, t]
  )

  const totalInputTokens = tokenUsage?.inputTokens || 0
  const totalOutputTokens = tokenUsage?.outputTokens || 0
  const totalCacheReadInputTokens = tokenUsage?.cacheReadInputTokens || 0
  const totalCacheWriteInputTokens = tokenUsage?.cacheWriteInputTokens || 0
  const estimatedCost = (tokenUsage?.totalCostMicros || 0) / 1_000_000
  const totalCostMicros = tokenUsage?.totalCostMicros || 0
  const [pricingLastUpdated, setPricingLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (!showCostDialog || !dbReady || !services?.pricingService) return
    void services.pricingService.getStatus().then((status) => {
      if (status.lastUpdated) {
        setPricingLastUpdated(new Date(status.lastUpdated))
      }
    })
  }, [showCostDialog, dbReady, services])

  const handleRefreshPricing = useCallback(async () => {
    if (!services?.pricingService) {
      return { success: false, error: t('agent.chat.pricing_refresh_failed', '刷新失败') }
    }
    try {
      const result = await services.pricingService.refresh()
      if (result.lastUpdated) {
        setPricingLastUpdated(new Date(result.lastUpdated))
      }
      if (result.success) {
        toast.showSuccess(t('agent.chat.pricing_refreshed', '价格表已更新'))
      }
      return {
        success: result.success,
        error: result.success ? undefined : t('agent.chat.pricing_refresh_failed', '刷新失败')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, error: msg }
    }
  }, [services, t, toast])
  const assistantDisplayName = currentAssistant?.name || LATTE_ASSISTANT_NAME
  const chatAiProfile = useMemo(
    () => ({
      name: assistantDisplayName,
      emoji: currentAssistant?.emoji,
      avatarPath: currentAssistant?.avatarPath || null,
      resolvedAvatarUri: resolvedCurrentAvatarUri || null
    }),
    [assistantDisplayName, currentAssistant, resolvedCurrentAvatarUri]
  )
  const chatUserProfile = useMemo(
    () => ({
      nickname: userProfile.nickname || t('agent.chat.you_label', '你'),
      avatarPath: userProfile.avatarPath,
      resolvedAvatarUri: resolvedUserAvatarUri || null
    }),
    [userProfile, t, resolvedUserAvatarUri]
  )

  const showStreamingFooter = isStreaming || isStreamBridgeActive

  const lastMessage = messages[messages.length - 1]
  /** 对齐桌面 AgentMessageList：助手已落库后改由列表 ChatBubble 展示，不再挂 Footer StreamingBubble */
  const assistantPersistedInList = useMemo(() => {
    if (lastMessage?.role !== 'assistant') return false
    return Boolean(
      lastMessage.content?.trim() ||
        lastMessage.reasoning?.trim() ||
        ((lastMessage.toolInvocations?.length ?? 0) > 0)
    )
  }, [lastMessage])

  const showStreamingBubble = useMemo(() => {
    if (!showStreamingFooter) return false
    if (assistantPersistedInList) return false
    // 对齐桌面：流式/桥接期间占位（含重发后尚无 token 的空白阶段）
    if (
      isCompressing &&
      !streamingText.trim() &&
      !streamingReasoning.trim() &&
      !activeTool &&
      completedTools.length === 0
    ) {
      return false
    }
    return true
  }, [
    showStreamingFooter,
    assistantPersistedInList,
    isCompressing,
    streamingText,
    streamingReasoning,
    activeTool,
    completedTools.length
  ])

  useEffect(() => {
    setAgentScrollDebugContext({
      sessionId: currentSessionId,
      messagesCount: messages.length,
      isStreaming,
      isStreamBridgeActive,
      showStreamingFooter,
      showStreamingBubble,
      assistantPersistedInList
    })
  }, [
    currentSessionId,
    messages.length,
    isStreaming,
    isStreamBridgeActive,
    showStreamingFooter,
    showStreamingBubble,
    assistantPersistedInList
  ])

  const prevShowStreamingBubbleRef = useRef(showStreamingBubble)
  useEffect(() => {
    if (prevShowStreamingBubbleRef.current === showStreamingBubble) return
    logAgentScrollEvent('streaming_bubble_visibility', {
      showStreamingBubble,
      assistantPersistedInList,
      messagesCount: messages.length,
      offsetY: Math.round(scrollOffsetRef.current)
    })
    prevShowStreamingBubbleRef.current = showStreamingBubble
  }, [showStreamingBubble, assistantPersistedInList, messages.length])

  const prevShowStreamingFooterRef = useRef(showStreamingFooter)
  useEffect(() => {
    if (prevShowStreamingFooterRef.current === showStreamingFooter) return
    logAgentScrollEvent('footer_visibility', {
      showStreamingFooter,
      messagesCount: messages.length,
      offsetY: Math.round(scrollOffsetRef.current)
    })
    prevShowStreamingFooterRef.current = showStreamingFooter
  }, [showStreamingFooter, messages.length])

  useEffect(() => {
    setAgentScrollDebugContext({
      visibleMessagesCount: messages.length
    })
  }, [messages.length])

  /** 对齐桌面 AgentMessageList：有 reasoning 且尚无正文时视为思考中 */
  const streamingReasoningActive = useMemo(
    () => Boolean(streamingReasoning.trim() && !streamingText.trim()),
    [streamingReasoning, streamingText]
  )

  /** 思考正文走 Streamdown 渐显：纯思考阶段或整段流式未结束 */
  const streamingThinkActive = useMemo(
    () =>
      Boolean(
        streamingReasoning.trim() &&
          (streamingReasoningActive || isStreaming || isStreamBridgeActive)
      ),
    [streamingReasoning, streamingReasoningActive, isStreaming, isStreamBridgeActive]
  )

  const streamingCompletedTools = useMemo(
    () =>
      completedTools.map((tool, idx) => ({
        name: tool.name,
        durationMs: tool.endTime && tool.startTime ? tool.endTime - tool.startTime : 0,
        result: tool.result,
        toolCallId: tool.toolCallId ?? `streaming-${tool.name}-${idx}`
      })),
    [completedTools]
  )

  const showStreamingTail = showStreamingBubble
  const liveAssistantActive =
    showStreamingFooter || streamPresentationLinger || holdLivePresentation
  const hasStreamingBody = Boolean(
    streamingText.trim() ||
      streamingReasoning.trim() ||
      activeTool ||
      completedTools.length > 0
  )

  const chatRows = useMemo(() => {
    const rows: Array<
      { kind: 'message'; item: (typeof messages)[number] } | { kind: 'stream-tail' }
    > = messages.map((item) => ({ kind: 'message', item }))
    if (showStreamingTail) {
      rows.push({ kind: 'stream-tail' })
    }
    return rows
  }, [messages, showStreamingTail])

  const bubbleTextStreaming = isStreaming || isStreamBridgeActive

  const liveStreamProps = useMemo(
    () => ({
      content: streamingText,
      reasoning: streamingReasoning,
      isTextStreaming: bubbleTextStreaming,
      isThinkStreaming:
        !assistantPersistedInList && streamingThinkActive && bubbleTextStreaming,
      activeToolName: activeToolDisplayName,
      completedTools: streamingCompletedTools
    }),
    [
      streamingText,
      streamingReasoning,
      bubbleTextStreaming,
      streamingThinkActive,
      assistantPersistedInList,
      activeToolDisplayName,
      streamingCompletedTools
    ]
  )

  /** 尚无正文时仅用 StreamingBubble 显示等待点；有内容后统一走 ChatBubble */
  const renderStreamingDots = useCallback(
    () => (
      <View key={LIVE_ASSISTANT_STREAM_KEY} style={styles.bubble}>
        <StreamingBubble
          text=""
          reasoning=""
          isReasoning={false}
          isThinkStreaming={false}
          isTextStreaming={bubbleTextStreaming}
          activeToolName={activeToolDisplayName}
          completedTools={streamingCompletedTools}
          aiProfile={chatAiProfile}
          invertMetaOverBackground={hasChatBackground}
        />
      </View>
    ),
    [
      bubbleTextStreaming,
      activeToolDisplayName,
      streamingCompletedTools,
      chatAiProfile,
      hasChatBackground
    ]
  )

  useEffect(() => {
    logAgentUiEvent('linger_change', { streamPresentationLinger })
  }, [streamPresentationLinger])

  useEffect(() => {
    logAgentUiEvent('live_assistant_active', { liveAssistantActive, hasStreamingBody })
  }, [liveAssistantActive, hasStreamingBody])

  useEffect(() => {
    if (isStreaming || isStreamBridgeActive) {
      setHoldLivePresentation(true)
      setKeepLiveRowAfterHold(false)
    }
  }, [isStreaming, isStreamBridgeActive])

  useEffect(() => {
    if (streamPresentationLinger) {
      setHoldLivePresentation(true)
      return
    }
    if (!holdLivePresentation) return
    const timer = setTimeout(() => setHoldLivePresentation(false), HOLD_LIVE_PRESENTATION_MS)
    return () => clearTimeout(timer)
  }, [streamPresentationLinger, holdLivePresentation])

  const prevAssistantPersistedRef = useRef(assistantPersistedInList)
  const prevLingerRef = useRef(streamPresentationLinger)
  useLayoutEffect(() => {
    if (
      !prevAssistantPersistedRef.current &&
      assistantPersistedInList &&
      (isStreaming || isStreamBridgeActive || streamPresentationLinger)
    ) {
      beginContentHandoff()
      logAgentUiEvent('assistant_persisted', { messageId: lastMessage?.id })
    }
    prevAssistantPersistedRef.current = assistantPersistedInList
  }, [
    assistantPersistedInList,
    beginContentHandoff,
    isStreaming,
    isStreamBridgeActive,
    streamPresentationLinger,
    lastMessage?.id
  ])

  useLayoutEffect(() => {
    if (prevLingerRef.current && !streamPresentationLinger) {
      logAgentUiEvent('linger_end_chrome_show', { messageId: lastMessage?.id })
    }
    prevLingerRef.current = streamPresentationLinger
  }, [streamPresentationLinger, lastMessage?.id])

  const prevHoldLiveRef = useRef(holdLivePresentation)
  useLayoutEffect(() => {
    if (prevHoldLiveRef.current && !holdLivePresentation) {
      setKeepLiveRowAfterHold(true)
      finalizeContentHandoff()
      requestAnimationFrame(() => {
        setKeepLiveRowAfterHold(false)
      })
    }
    prevHoldLiveRef.current = holdLivePresentation
  }, [holdLivePresentation, finalizeContentHandoff])

  const listContentStyle = useMemo(
    () =>
      contentAnchorMinHeight != null
        ? [styles.listContent, { minHeight: contentAnchorMinHeight }]
        : styles.listContent,
    [contentAnchorMinHeight]
  )

  const listFooter = useMemo(
    () => (
      <View>
        <Animated.View style={listSpacerAnimatedStyle} />
      </View>
    ),
    [listSpacerAnimatedStyle]
  )

  const renderEmptyState = () => (
    <View style={styles.empty}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + '26' }]}>
        <MaterialIcons
          name="auto-awesome"
          size={38}
          color={colors.primary}
          style={{ opacity: 0.7 }}
        />
      </View>
      <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
        {t('agent.chat.start_chat', '开始和伙伴对话')}
      </Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
        {t('agent.chat.empty_hint', '试试问：「我这周写了什么日记？」')}
      </Text>
    </View>
  )

  const ChatBackgroundWrapper = (resolvedChatBackgroundUri ? ImageBackground : View) as typeof View
  const chatBackgroundWrapperProps = resolvedChatBackgroundUri
    ? {
        source: { uri: resolvedChatBackgroundUri },
        resizeMode: 'cover' as const,
        imageStyle: styles.backgroundImageInner,
        blurRadius: chatBackgroundBlur
      }
    : {}

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgApp}
      />
      <ScreenSafeArea preset="tab" style={{ backgroundColor: colors.bgApp }}>
        <ChatBackgroundWrapper
          key={userProfile.chatBackgroundPath ?? 'default-chat-bg'}
          style={styles.backgroundImage}
          {...chatBackgroundWrapperProps}
        >
          {resolvedChatBackgroundUri && chatBackgroundOverlay > 0 ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: `rgba(0, 0, 0, ${chatBackgroundOverlay / 100})` }
              ]}
            />
          ) : null}
          <View style={styles.container}>
            <AgentChatAppBar
              modelName={displayModelName || ''}
              costMicros={totalCostMicros}
              onMenuPress={() => setDrawerOpen(true)}
              onModelPress={() => setShowModelSwitcher(true)}
              onCostPress={() => setShowCostDialog(true)}
            />

            <AgentDrawerSwipeZone enabled={drawerSwipeEnabled} onOpen={() => setDrawerOpen(true)}>
              <ScrollView
                ref={flatListRef}
                style={styles.list}
                contentContainerStyle={listContentStyle}
                nestedScrollEnabled
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
                onLayout={() => {
                  if (!layoutReadyRef.current) {
                    layoutReadyRef.current = true
                    requestAnimationFrame(() =>
                      flatListRef.current?.scrollToEnd({ animated: false })
                    )
                  }
                }}
                onScroll={handleListScroll}
                onScrollBeginDrag={handleScrollBeginDrag}
                onScrollEndDrag={handleScrollEndDrag}
                onMomentumScrollBegin={handleMomentumScrollBegin}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                onContentSizeChange={handleListContentSizeChange}
                scrollEventThrottle={16}
              >
                {hasMore && showLoadMoreBanner ? (
                  <TouchableOpacity
                    style={[
                      styles.loadMore,
                      {
                        borderColor: colors.borderSubtle,
                        backgroundColor: colors.bgGlassSurface ?? colors.bgSurface
                      }
                    ]}
                    onPress={() => void handleLoadMore()}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                      {t('agent.chat.load_earlier_messages', '加载更早对话')}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {!isStreaming && !isStreamBridgeActive && messages.length === 0
                  ? renderEmptyState()
                  : null}

                {chatRows.map((row) => {
                  if (row.kind === 'stream-tail') {
                    if (!hasStreamingBody) {
                      return renderStreamingDots()
                    }
                  }

                  const item = row.kind === 'message' ? row.item : null
                  if (!item) {
                    const tailItem = {
                      id: LIVE_ASSISTANT_STREAM_KEY,
                      role: 'assistant' as const,
                      content: streamingText,
                      reasoning: streamingReasoning
                    }
                    return (
                      <View key={LIVE_ASSISTANT_STREAM_KEY} style={styles.bubble}>
                        <AgentMessageRow
                          item={tailItem as any}
                          chatUserProfile={chatUserProfile}
                          chatAiProfile={chatAiProfile}
                          isLiveCompressionAnchor={false}
                          liveCompression={IDLE_LIVE_COMPRESSION}
                          liveStream={liveStreamProps}
                          deferAssistantChrome
                          onRegenerate={() => {}}
                          onCopy={() => {}}
                          onDelete={() => {}}
                          invertMetaOverBackground={hasChatBackground}
                          retryDisabled
                        />
                      </View>
                    )
                  }

                  const msgWithCompaction = item as typeof item & {
                    compactionRecord?: { streamTranscript?: string } | null
                  }
                  const isLiveCompressionAnchor =
                    (compressionPhase === 'auto' || compressionPhase === 'manual') &&
                    compressionTriggerMessageId === item.id &&
                    isCompressing

                  const liveCompression = isLiveCompressionAnchor
                    ? {
                        phase: compressionPhase,
                        summary: compressionText,
                        reasoning: compressionReasoning,
                        isActive: isCompressing
                      }
                    : IDLE_LIVE_COMPRESSION

                  const isLastAssistant =
                    item.role === 'assistant' && item.id === lastMessage?.id
                  const isLiveAssistantRow =
                    isLastAssistant && (liveAssistantActive || keepLiveRowAfterHold)
                  const rowKey = isLastAssistant ? LIVE_ASSISTANT_STREAM_KEY : item.id

                  const rowLiveStream = isLiveAssistantRow
                    ? {
                        content: assistantPersistedInList
                          ? item.content
                          : streamingText.trim() || item.content,
                        reasoning: assistantPersistedInList
                          ? item.reasoning || ''
                          : streamingReasoning.trim() || item.reasoning || '',
                        isTextStreaming: bubbleTextStreaming,
                        isThinkStreaming: assistantPersistedInList
                          ? false
                          : liveStreamProps.isThinkStreaming
                      }
                    : undefined

                  const deferChromeForRow =
                    isLiveAssistantRow &&
                    (isStreaming || isStreamBridgeActive || streamPresentationLinger)

                  return (
                    <View
                      key={rowKey}
                      ref={item.id === editingMessageId ? editingRowRef : undefined}
                      collapsable={false}
                      style={styles.bubble}
                    >
                      <AgentMessageRow
                        item={msgWithCompaction as any}
                        chatUserProfile={chatUserProfile}
                        chatAiProfile={chatAiProfile}
                        isLiveCompressionAnchor={isLiveCompressionAnchor}
                        liveCompression={liveCompression}
                        liveStream={rowLiveStream}
                        deferAssistantChrome={deferChromeForRow}
                        onRegenerate={() => handleRegenerate(item.id)}
                        onResend={
                          item.role === 'user' ? () => void handleResend(item.id) : undefined
                        }
                        onResendEdit={
                          item.role === 'user'
                            ? (content) => handleEditMessage(item.id, content)
                            : undefined
                        }
                        onSaveEdit={
                          item.role === 'assistant'
                            ? (content) => handleSaveAssistantEdit(item.id, content)
                            : undefined
                        }
                        onCopy={() => Clipboard.setStringAsync(item.content)}
                        onDelete={() => handleDeleteMessage(item.id)}
                        onReadAloud={
                          item.role === 'assistant'
                            ? () => handleTtsReadAloud(item.content, item.id)
                            : undefined
                        }
                        isTtsPlaying={ttsPlayingMsgId === item.id}
                        onShowContext={
                          item.role === 'assistant' ? () => handleShowContext(item) : undefined
                        }
                        onBranch={
                          item.role === 'assistant' ? () => handleBranch(item.id) : undefined
                        }
                        onBubbleEditingChange={handleBubbleEditingChange}
                        invertMetaOverBackground={hasChatBackground}
                        retryDisabled={isRetryActionBusy || isStreaming || isCompressing}
                      />
                    </View>
                  )
                })}

                {listFooter}
              </ScrollView>
            </AgentDrawerSwipeZone>

            {showScrollButton && !isBubbleEditing ? (
              <Animated.View
                pointerEvents="box-none"
                style={[styles.scrollBtnWrap, scrollButtonAnimatedStyle]}
              >
                <TouchableOpacity
                  style={[styles.scrollBtn, { backgroundColor: colors.bgSurface }]}
                  onPress={() => scrollToBottom(flatListRef, true)}
                  accessibilityLabel={t('agent.chat.scroll_to_bottom', '回到最新消息')}
                >
                  <MaterialIcons
                    name="keyboard-arrow-down"
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </Animated.View>
            ) : null}

            <Animated.View
              onLayout={(event) => {
                const next = Math.ceil(event.nativeEvent.layout.height)
                if (next > 0 && next !== inputDockHeight) setInputDockHeight(next)
              }}
              style={[
                styles.inputDock,
                inputDockAnimatedStyle,
                {
                  backgroundColor: colors.bgSurface,
                  opacity: isBubbleEditing ? 0.92 : 1
                }
              ]}
              pointerEvents={isBubbleEditing ? 'none' : 'auto'}
            >
              <InputBar
                ref={inputBarRef}
                onSend={handleSendWithScroll}
                isLoading={isLoading || isStreaming}
                onStop={handleStop}
                composerBlocked={!hasConfiguredDialogueModel}
                onComposerBlocked={() =>
                  toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
                }
                composerDraftKey={composerDraftKey}
                composerDraftStorage={mobileComposerDraftStorage}
                composerEnabled={!isBubbleEditing}
                onInputFocus={handleInputBarFocus}
                shortcuts={shortcuts}
                assistantName={assistantDisplayName}
                onManageShortcuts={() => setShowShortcutSheet(true)}
                onRecall={() => setShowRecallSheet(true)}
                onOpenTools={() => router.push('/(tabs)/agent/tools' as Href)}
                searchMode={searchMode}
                onToggleSearchMode={toggleSearchMode}
                ttsMode={ttsMode}
                onToggleTtsMode={toggleTtsMode}
              />
            </Animated.View>
          </View>
        </ChatBackgroundWrapper>
      </ScreenSafeArea>

      <AgentDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentAssistant={
          currentAssistant
            ? {
                id: currentAssistant.id,
                name: currentAssistant.name,
                description: currentAssistant.description,
                emoji: currentAssistant.emoji,
                avatarPath: currentAssistant.avatarPath ?? undefined,
                displayAvatarUri: resolvedCurrentAvatarUri || undefined,
                assistantKind: currentAssistant.assistantKind
              }
            : null
        }
        pinnedAssistants={pinnedAssistants}
        sessions={sessions}
        sessionListScrollKey={sessionListScrollKey}
        hasMoreSessions={hasMoreSessions}
        isLoadingMoreSessions={isLoadingMoreSessions}
        onLoadMoreSessions={() => void loadSessions(false)}
        onRefreshSessions={() => void loadSessions(true)}
        selectedSessionId={currentSessionId || undefined}
        onSelectSession={handleSelectSession}
        onCreateSession={() => {
          void handleCreateSession({
            assistantId: currentAssistant?.id,
            providerId: currentProviderId || undefined,
            modelId: currentModelId || undefined
          }).then((sessionId) => {
            if (sessionId) refreshSessionList()
          })
        }}
        onShowAssistantPicker={() => setShowAssistantPicker(true)}
        onSelectAssistant={(assistant) => {
          void handleSelectAssistantWithTracking(assistant)
        }}
        onPinSession={handlePinSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
      />

      <AssistantPicker
        isVisible={showAssistantPicker}
        onClose={() => setShowAssistantPicker(false)}
        onSelect={(a) => void handleSelectAssistantWithTracking(a)}
        selectedAssistantId={currentAssistant?.id}
        assistants={pickerAssistants}
      />

      <ModelSwitcher
        isVisible={showModelSwitcher}
        onClose={() => setShowModelSwitcher(false)}
        onSelect={handleSelectModel}
        currentProviderId={currentProviderId || undefined}
        currentModelId={currentModelId || undefined}
      />

      <ChatCostDialog
        isOpen={showCostDialog}
        onClose={() => setShowCostDialog(false)}
        details={{
          modelName: displayModelName || t('agent.no_model_selected', '暂未选择模型'),
          promptTokens: totalInputTokens,
          completionTokens: totalOutputTokens,
          cacheReadTokens: totalCacheReadInputTokens,
          cacheWriteTokens: totalCacheWriteInputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
          estimatedCost: `$${estimatedCost.toFixed(6)}`
        }}
        pricingLastUpdated={pricingLastUpdated}
        onRefreshPricing={handleRefreshPricing}
      />

      <PromptShortcutSheet
        visible={showShortcutSheet}
        onClose={() => setShowShortcutSheet(false)}
        shortcuts={shortcuts}
        onSelect={handleShortcutSelect}
        onAdd={addShortcut}
        onUpdate={updateShortcut}
        onDelete={deleteShortcut}
        onReorder={reorderShortcuts}
      />

      <RecallDialog
        isOpen={showRecallSheet}
        onClose={() => setShowRecallSheet(false)}
        items={recallItems}
        isSearching={isSearchingRecall}
        onSearch={handleRecallSearch}
        onInject={handleInjectRecall}
        searchMode={recallSearchMode}
        onToggleSearchMode={toggleRecallSearchMode}
        lookbackMonths={recallLookbackMonths}
        onMonthsChanged={setRecallLookbackMonths}
        onCopyContext={async () => {
          try {
            const contextText = await services?.buildSharedContext?.(
              recallLookbackMonths,
              i18n.language
            )
            if (contextText) {
              await Clipboard.setStringAsync(contextText)
              toast.showSuccess(t('summary.toast_copied', '共同回忆已复制'))
            }
          } catch (e: unknown) {
            console.error('[AgentScreen] Copy shared context failed:', e)
            toast.showError(t('common.copy_failed', '复制失败'))
          }
        }}
        onCopyDiarySnippet={async (snippet) => {
          try {
            await Clipboard.setStringAsync(snippet)
            toast.showSuccess(t('recall.copy_success', '已复制记忆到剪贴板！'))
          } catch {
            toast.showError(t('common.copy_failed', '复制失败'))
          }
        }}
      />

      <ContextChainDialog
        visible={contextDialogState.visible}
        onClose={() => setContextDialogState((prev) => ({ ...prev, visible: false }))}
        message={contextDialogState.message}
        flatEntries={contextDialogState.flatEntries}
        meta={contextDialogState.meta}
        compressedContent={contextDialogState.compressedContent}
        systemPrompt={contextDialogState.systemPrompt}
        sessionId={activeContextSessionId}
        recompressBusy={contextRecompressJob?.status === 'running'}
        recompressStartedAt={
          contextRecompressJob?.status === 'running' ? contextRecompressJob.startedAt : undefined
        }
        recompressStreamText={isCompressing && compressionPhase === 'manual' ? compressionText : ''}
        recompressStreamReasoning={
          isCompressing && compressionPhase === 'manual' ? compressionReasoning : ''
        }
        recompressError={
          contextRecompressJob?.status === 'error' ? contextRecompressJob.error : null
        }
        onRecompress={() => {
          const sid = contextDialogState.sessionId ?? currentSessionId
          if (sid) void runContextRecompress(sid)
        }}
        onRecompressDismissError={dismissContextRecompressError}
      />
    </>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  backgroundImage: { flex: 1 },
  backgroundImageInner: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  loadMore: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600'
  },
  list: { flex: 1 },
  /** 不用 flexGrow:1，否则内容变短（流式 Footer 移除）时 ScrollView 常把 offset 钳到 0 */
  listContent: { paddingTop: 24, paddingBottom: 0, paddingHorizontal: 0 },
  bubble: { marginBottom: 14 },
  toolStatusContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 6
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  toolCheckmark: {
    fontSize: 14,
    fontWeight: '700'
  },
  toolSpinner: {
    fontSize: 14,
    fontWeight: '700'
  },
  toolName: {
    fontSize: 13,
    fontWeight: '500'
  },
  toolNameActive: {
    fontSize: 13,
    fontWeight: '600'
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '24%',
    paddingHorizontal: 24
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center'
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.7
  },
  scrollBtnWrap: {
    position: 'absolute',
    right: 24
  },
  scrollBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4
  },
  inputDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'visible',
    zIndex: 10
  }
})
