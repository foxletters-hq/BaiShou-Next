import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { type PromptShortcut } from '@baishou/shared'
import {
  View,
  StyleSheet,
  FlatList,
  StatusBar,
  TouchableOpacity,
  Text,
  Alert,
  Pressable,
  Platform,
  Dimensions,
  Keyboard,
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
  PromptShortcutSheet
} from '@baishou/ui/native'
import { useNativeTheme, useNativeToast, useKeyboardHeight } from '@baishou/ui/native'
import { useAgentStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'

import { AgentChatAppBar } from '../components/AgentChatAppBar'
import { AgentMessageRow } from '../components/AgentMessageRow'
import { ScreenSafeArea } from '../components/ScreenSafeArea'
import { AgentDrawer, type AssistantSummary } from '../components/AgentDrawer'
import { AssistantPicker } from '../components/AssistantPicker'
import { ModelSwitcher } from '../components/ModelSwitcher'
import { ContextChainDialog } from '../components/ContextChainDialog'
import { useBaishou } from '../providers/BaishouProvider'
import { useAgentSession } from '../hooks/useAgentSession'
import { useAgentStream } from '../hooks/useAgentStream'
import { useAgentModel } from '../hooks/useAgentModel'
import { useAgentUI } from '../hooks/useAgentUI'
import { useTTS } from '../hooks/useTTS'
import { useBranchSession } from '../hooks/useBranchSession'
import { useStreamError } from '../hooks/useStreamError'
import { useMobilePromptShortcuts } from '../hooks/useMobilePromptShortcuts'
import { useResolvedAssistantAvatar } from '../hooks/useResolvedAssistantAvatar'
import { resolveAssistantAvatarDisplayUri } from '../lib/assistant-avatar-uri'
/** 底部输入栏 + 工具条的大致高度，用于「回到底部」悬浮按钮定位 */
const INPUT_DOCK_HEIGHT = 136
/** 编辑态：保存按钮与 token 行距键盘顶部的留白 */
const BUBBLE_EDIT_KEYBOARD_BUFFER = 72
/** 编辑态且键盘收起时：保存/token 与底部工具栏之间的额外间距 */
const BUBBLE_EDIT_DOCK_GAP = 16

export const AgentScreen = () => {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { isLoading, searchMode, toggleSearchMode } = useAgentStore()
  const { colors, isDark } = useNativeTheme()
  /** 遮罩层内输入框聚焦时不应顶起主聊天输入栏 */
  const keyboardOverlayRef = useRef(false)
  const { keyboardHeight, resetKeyboard } = useKeyboardHeight({
    shouldIgnoreShow: () => keyboardOverlayRef.current
  })
  const tabBarHeight = useBottomTabBarHeight()
  /** 键盘高度从屏幕底量起，输入区位于 Tab 栏上方，需扣除 Tab 栏高度，避免输入框与键盘间出现空隙 */
  const inputOffset = Math.max(0, keyboardHeight - tabBarHeight)
  const [isBubbleEditing, setIsBubbleEditing] = useState(false)
  const [recallLookbackMonths, setRecallLookbackMonths] = useState(1)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [inputDockHeight, setInputDockHeight] = useState(INPUT_DOCK_HEIGHT)
  /** 气泡内联编辑时：底部主输入栏不随键盘上移，列表仅为键盘留白（不再叠加入口栏高度） */
  const dockBottomOffset = isBubbleEditing ? 0 : inputOffset
  const bubbleEditKeyboardInset = Math.max(0, keyboardHeight - tabBarHeight)
  const isEditKeyboardVisible = keyboardHeight >= 60
  const listBottomPadding = isBubbleEditing
    ? isEditKeyboardVisible
      ? bubbleEditKeyboardInset + BUBBLE_EDIT_KEYBOARD_BUFFER + 16
      : inputDockHeight + BUBBLE_EDIT_KEYBOARD_BUFFER + BUBBLE_EDIT_DOCK_GAP
    : inputDockHeight + inputOffset + 24

  const handleBubbleEditingChange = useCallback((editing: boolean, messageId?: string) => {
    setIsBubbleEditing(editing)
    setEditingMessageId(editing && messageId ? messageId : null)
  }, [])

  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()
  const flatListRef = useRef<FlatList>(null)
  const inputBarRef = useRef<InputBarRef>(null)
  const editingRowRef = useRef<View>(null)
  const scrollOffsetRef = useRef(0)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [assistants, setAssistants] = useState<Array<AssistantSummary & { isPinned?: boolean }>>([])
  const [userProfile, setUserProfile] = useState<{
    nickname: string
    avatarPath?: string | null
  }>({ nickname: '' })

  const {
    currentSessionId,
    setCurrentSessionId,
    hasMore,
    messages,
    handleLoadMore,
    handleSelectSession,
    handleAssistantSwitched,
    handleCreateSession,
    handleDeleteSession,
    handlePinSession,
    handleRenameSession
  } = useAgentSession()

  /** 按行实测位置微调滚动：键盘展开时避开键盘，收起时避开底部工具栏 */
  const scrollEditingMessageIntoView = useCallback(() => {
    if (!editingMessageId) return
    const row = editingRowRef.current
    if (!row) return

    row.measureInWindow((_x, y, _w, height) => {
      const windowHeight = Dimensions.get('window').height
      const keyboardOpen = keyboardHeight >= 60
      const safeBottom = keyboardOpen
        ? windowHeight - keyboardHeight - BUBBLE_EDIT_KEYBOARD_BUFFER
        : windowHeight - tabBarHeight - inputDockHeight - BUBBLE_EDIT_DOCK_GAP
      const rowBottom = y + height
      if (rowBottom <= safeBottom + 4) return

      flatListRef.current?.scrollToOffset({
        offset: scrollOffsetRef.current + (rowBottom - safeBottom),
        animated: true
      })
    })
  }, [editingMessageId, keyboardHeight, tabBarHeight, inputDockHeight])

  useEffect(() => {
    if (!isBubbleEditing || !editingMessageId) return
    const early = setTimeout(scrollEditingMessageIntoView, Platform.OS === 'ios' ? 80 : 160)
    const late = setTimeout(scrollEditingMessageIntoView, Platform.OS === 'ios' ? 340 : 480)
    return () => {
      clearTimeout(early)
      clearTimeout(late)
    }
  }, [isBubbleEditing, editingMessageId, keyboardHeight, scrollEditingMessageIntoView])

  const {
    currentAssistant,
    currentProviderId,
    currentModelId,
    showAssistantPicker,
    showModelSwitcher,
    setShowAssistantPicker,
    setShowModelSwitcher,
    handleSelectAssistant,
    handleSelectModel,
    setCurrentAssistant
  } = useAgentModel()

  const resolvedCurrentAvatarUri = useResolvedAssistantAvatar(currentAssistant?.avatarPath)

  const {
    isStreaming,
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
    searchMode
  )

  const {
    showCostDialog,
    showScrollButton,
    showShortcutSheet,
    showRecallSheet,
    recallItems,
    isSearchingRecall,
    setShowCostDialog,
    setShowShortcutSheet,
    setShowRecallSheet,
    handleScroll,
    scrollToBottom,
    handleRecallSearch,
    handleInjectRecall,
    recallSearchMode,
    toggleRecallSearchMode
  } = useAgentUI()

  useEffect(() => {
    const overlaysOpen = drawerOpen || showShortcutSheet || showRecallSheet
    keyboardOverlayRef.current = overlaysOpen
    if (overlaysOpen) {
      resetKeyboard()
      Keyboard.dismiss()
    }
  }, [drawerOpen, showShortcutSheet, showRecallSheet, resetKeyboard])

  const { shortcuts, addShortcut, updateShortcut, deleteShortcut, reorderShortcuts } =
    useMobilePromptShortcuts(showShortcutSheet)

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y
      handleScroll(event)
    },
    [handleScroll]
  )

  const { ttsPlayingMsgId, handleTtsReadAloud } = useTTS()
  const { branchSession } = useBranchSession()
  useStreamError(streamError, isStreaming)

  const loadAssistants = useCallback(async () => {
    if (!dbReady || !services) return
    try {
      const list = (await services.settingsManager.get<any[]>('assistants')) || []
      const mapped = await Promise.all(
        list.map(async (a) => {
          const displayAvatarUri = await resolveAssistantAvatarDisplayUri(a.avatarPath, (path) =>
            services.attachmentManager.resolveAvatarPath(path)
          )
          return {
            id: a.id,
            name: a.name,
            description: a.description,
            emoji: a.emoji,
            avatarPath: a.avatarPath,
            displayAvatarUri,
            isPinned: Boolean(a.isPinned),
            lastUsedAt: a.lastUsedAt || 0
          }
        })
      )
      setAssistants(mapped)
    } catch {
      setAssistants([])
    }
  }, [dbReady, services])

  const refreshCurrentAssistant = useCallback(async () => {
    if (!dbReady || !services || !currentAssistant?.id) return
    try {
      const list = (await services.settingsManager.get<any[]>('assistants')) || []
      const updated = list.find((a) => a.id === currentAssistant.id)
      if (updated) setCurrentAssistant(updated)
    } catch {
      // ignore
    }
  }, [dbReady, services, currentAssistant?.id, setCurrentAssistant])

  useEffect(() => {
    void loadAssistants()
  }, [loadAssistants, drawerOpen, showAssistantPicker])

  useFocusEffect(
    useCallback(() => {
      void loadAssistants()
      void refreshCurrentAssistant()
    }, [loadAssistants, refreshCurrentAssistant])
  )

  useEffect(() => {
    if (!dbReady || !services) return
    services.settingsManager
      .get<{ nickname?: string; avatarPath?: string | null }>('user_profile')
      .then((profile) =>
        setUserProfile({
          nickname: profile?.nickname || t('agent.chat.you_label', '你'),
          avatarPath: profile?.avatarPath
        })
      )
      .catch(() => setUserProfile({ nickname: t('agent.chat.you_label', '你') }))
  }, [dbReady, services, drawerOpen, t])

  const pinnedAssistants = useMemo(
    () =>
      assistants
        .filter((a) => a.isPinned)
        .slice(0, 3)
        .map(({ id, name, description, emoji, avatarPath, displayAvatarUri }) => ({
          id,
          name,
          description,
          emoji,
          avatarPath,
          displayAvatarUri
        })),
    [assistants]
  )

  const handleSelectAssistantWithTracking = useCallback(
    async (assistant: AssistantSummary) => {
      const full = assistants.find((a) => a.id === assistant.id)
      if (!full) return
      handleSelectAssistant(full as any)
      const fullWithModel = full as {
        providerId?: string
        modelId?: string
      }
      await handleAssistantSwitched(assistant.id, fullWithModel.providerId, fullWithModel.modelId)
      if (!services) return
      try {
        const list =
          (await services.settingsManager.get<
            Array<{
              id: string
              name: string
              emoji: string
              description?: string
              isPinned?: boolean
              lastUsedAt?: number
              [key: string]: unknown
            }>
          >('assistants')) || []
        const updated = list.map((a) =>
          a.id === assistant.id ? { ...a, lastUsedAt: Date.now() } : a
        )
        await services.settingsManager.set('assistants', updated)
        void loadAssistants()
      } catch {}
    },
    [assistants, handleSelectAssistant, handleAssistantSwitched, services, loadAssistants]
  )

  const handleShortcutSelect = useCallback(
    (shortcut: PromptShortcut) => {
      setShowShortcutSheet(false)
      if (shortcut.content.trim()) {
        inputBarRef.current?.insertText(shortcut.content.trim())
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
      if (ttsModeRef.current === 'always' && chatMessagesRef.current.length > 0) {
        const lastMsg = chatMessagesRef.current[chatMessagesRef.current.length - 1]
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
          handleTtsReadAloud(lastMsg.content, lastMsg.id)
        }
      }
    }
    prevIsStreamingRef.current = isStreaming
  }, [isStreaming, handleTtsReadAloud])

  const [contextDialogState, setContextDialogState] = useState<{
    visible: boolean
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
          message: {
            ...message,
            inputTokens: message.inputTokens,
            outputTokens: message.outputTokens,
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

  const prevMsgLenRef = useRef(0)
  const layoutReadyRef = useRef(false)

  useEffect(() => {
    if (messages.length > 0 && messages.length > prevMsgLenRef.current) {
      prevMsgLenRef.current = messages.length
      requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }))
    }
  }, [messages])

  const handleContentSizeChange = useCallback(() => {
    if (messages.length > prevMsgLenRef.current) {
      prevMsgLenRef.current = messages.length
      requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }))
    }
  }, [messages.length])

  const totalInputTokens = tokenUsage?.inputTokens || 0
  const totalOutputTokens = tokenUsage?.outputTokens || 0
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
  const assistantDisplayName =
    currentAssistant?.name || t('agent.assistant.default_assistant_name', '默认伙伴')
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
      avatarPath: userProfile.avatarPath
    }),
    [userProfile, t]
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

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgApp}
      />
      <ScreenSafeArea preset="tab" style={{ backgroundColor: colors.bgApp }}>
        <View style={styles.container}>
          <AgentChatAppBar
            modelName={currentModelId || ''}
            costMicros={totalCostMicros}
            onMenuPress={() => setDrawerOpen(true)}
            onModelPress={() => setShowModelSwitcher(true)}
            onCostPress={() => setShowCostDialog(true)}
          />

          {hasMore && (
            <TouchableOpacity style={styles.loadMore} onPress={handleLoadMore}>
              <Text style={[styles.loadMoreText, { color: colors.textSecondary }]}>
                {t('common.load_more', '点击加载更多记录')}
              </Text>
            </TouchableOpacity>
          )}

          <FlatList
            ref={flatListRef}
            style={styles.list}
            contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
            data={messages}
            keyExtractor={(item) => item.id}
            nestedScrollEnabled
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="interactive"
            renderItem={({ item }) => {
              const msgWithCompaction = item as typeof item & {
                compactionRecord?: { streamTranscript?: string } | null
              }
              const isLiveCompressionAnchor =
                (compressionPhase === 'auto' || compressionPhase === 'manual') &&
                compressionTriggerMessageId === item.id &&
                (isCompressing ||
                  ((Boolean(compressionText?.trim()) || Boolean(compressionReasoning?.trim())) &&
                    !msgWithCompaction.compactionRecord))

              return (
                <View
                  ref={item.id === editingMessageId ? editingRowRef : undefined}
                  collapsable={false}
                  style={styles.bubble}
                >
                  <AgentMessageRow
                    item={msgWithCompaction as any}
                    chatUserProfile={chatUserProfile}
                    chatAiProfile={chatAiProfile}
                    isLiveCompressionAnchor={isLiveCompressionAnchor}
                    liveCompression={{
                      phase: compressionPhase,
                      summary: compressionText,
                      reasoning: compressionReasoning,
                      isActive: isCompressing
                    }}
                    onRegenerate={() => handleRegenerate(item.id)}
                    onResend={item.role === 'user' ? () => void handleResend(item.id) : undefined}
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
                    onBranch={item.role === 'assistant' ? () => handleBranch(item.id) : undefined}
                    onBubbleEditingChange={handleBubbleEditingChange}
                  />
                </View>
              )
            }}
            ListFooterComponent={
              isStreaming && !isCompressing ? (
                <View>
                  <StreamingBubble
                    text={streamingText}
                    reasoning={streamingReasoning}
                    isReasoning={isStreaming && !streamingText && !!streamingReasoning}
                    activeToolName={activeTool?.name ?? null}
                    completedTools={completedTools.map((tool) => ({
                      name: tool.name,
                      durationMs: tool.endTime && tool.startTime ? tool.endTime - tool.startTime : 0
                    }))}
                    aiProfile={chatAiProfile}
                  />
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
            onContentSizeChange={handleContentSizeChange}
            onLayout={() => {
              if (!layoutReadyRef.current) {
                layoutReadyRef.current = true
                requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: false }))
              }
            }}
            onScroll={handleListScroll}
            scrollEventThrottle={16}
            ListEmptyComponent={!isStreaming ? renderEmptyState() : null}
          />

          {showScrollButton && !isBubbleEditing && (
            <View
              pointerEvents="box-none"
              style={[styles.scrollBtnWrap, { bottom: dockBottomOffset + inputDockHeight + 12 }]}
            >
              <TouchableOpacity
                style={[styles.scrollBtn, { backgroundColor: colors.bgSurface }]}
                onPress={() => scrollToBottom(flatListRef, true)}
                accessibilityLabel={t('agent.chat.scroll_to_bottom', '回到最新消息')}
              >
                <MaterialIcons name="keyboard-arrow-down" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View
            onLayout={(event) => {
              const next = Math.ceil(event.nativeEvent.layout.height)
              if (next > 0 && next !== inputDockHeight) setInputDockHeight(next)
            }}
            style={[
              styles.inputDock,
              {
                backgroundColor: colors.bgSurface,
                bottom: dockBottomOffset,
                opacity: isBubbleEditing ? 0.92 : 1
              }
            ]}
            pointerEvents={isBubbleEditing ? 'none' : 'auto'}
          >
            <InputBar
              ref={inputBarRef}
              onSend={handleSend}
              isLoading={isLoading || isStreaming}
              onStop={handleStop}
              composerEnabled={!isBubbleEditing}
              assistantName={assistantDisplayName}
              onTriggerShortcut={() => setShowShortcutSheet(true)}
              onManageShortcuts={() => setShowShortcutSheet(true)}
              onRecall={() => setShowRecallSheet(true)}
              onOpenTools={() => router.push('/(tabs)/agent/tools' as Href)}
              searchMode={searchMode}
              onToggleSearchMode={toggleSearchMode}
              ttsMode={ttsMode}
              onToggleTtsMode={toggleTtsMode}
            />
          </View>
        </View>
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
                avatarPath: currentAssistant.avatarPath,
                displayAvatarUri: resolvedCurrentAvatarUri || undefined
              }
            : null
        }
        pinnedAssistants={pinnedAssistants}
        selectedSessionId={currentSessionId || undefined}
        onSelectSession={handleSelectSession}
        onCreateSession={() => {
          void handleCreateSession({
            assistantId: currentAssistant?.id,
            providerId: currentProviderId || undefined,
            modelId: currentModelId || undefined
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
          modelName: currentModelId || t('agent.no_model_selected', '暂未选择模型'),
          promptTokens: totalInputTokens,
          completionTokens: totalOutputTokens,
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
      />
    </>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  loadMore: { paddingVertical: 12, alignItems: 'center' },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
  list: { flex: 1 },
  listContent: { paddingVertical: 24, paddingHorizontal: 0, flexGrow: 1 },
  bubble: { marginBottom: 20 },
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
    right: 0
  }
})
