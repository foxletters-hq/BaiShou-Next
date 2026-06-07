import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  StyleSheet,
  FlatList,
  StatusBar,
  TouchableOpacity,
  Text,
  Alert,
  Modal,
  Pressable
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Clipboard from 'expo-clipboard'
import { MaterialIcons } from '@expo/vector-icons'
import {
  ChatBubble,
  InputBar,
  StreamingBubble,
  RecallDialog,
  ChatCostDialog,
  PromptShortcutSheet,
  AgentToolsView
} from '@baishou/ui/native'
import { useNativeTheme, useNativeToast, useKeyboardHeight } from '@baishou/ui/native'
import { useAgentStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'

import { partDataAsRecord } from '../utils/agent-part.util'
import { AgentChatAppBar } from '../components/AgentChatAppBar'
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
/** 底部输入栏 + 工具条的大致高度，用于「回到底部」悬浮按钮定位 */
const INPUT_DOCK_HEIGHT = 136

export const AgentScreen = () => {
  const { t } = useTranslation()
  const { isLoading, searchMode, toggleSearchMode } = useAgentStore()
  const { colors, isDark } = useNativeTheme()
  const { keyboardHeight } = useKeyboardHeight()
  const tabBarHeight = useBottomTabBarHeight()
  /** 键盘高度从屏幕底量起，输入区位于 Tab 栏上方，需扣除 Tab 栏高度，避免输入框与键盘间出现空隙 */
  const inputOffset = Math.max(0, keyboardHeight - tabBarHeight)
  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()
  const flatListRef = useRef<FlatList>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [assistants, setAssistants] = useState<Array<AssistantSummary & { isPinned?: boolean }>>([])
  const [shortcuts, setShortcuts] = useState<
    Array<{ id: string; icon: string; name: string; content: string }>
  >([])
  const [toolConfig, setToolConfig] = useState<{
    disabledToolIds: string[]
    customConfigs: Record<string, Record<string, unknown>>
  }>({ disabledToolIds: [], customConfigs: {} })
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
    handleCreateSession,
    handleDeleteSession,
    handlePinSession,
    handleRenameSession
  } = useAgentSession()

  const {
    currentAssistant,
    currentProviderId,
    currentModelId,
    showAssistantPicker,
    showModelSwitcher,
    setShowAssistantPicker,
    setShowModelSwitcher,
    handleSelectAssistant,
    handleSelectModel
  } = useAgentModel()

  const {
    isStreaming,
    streamError,
    streamingText,
    streamingReasoning,
    tokenUsage,
    activeTool,
    completedTools,
    handleSend,
    handleStop,
    handleRegenerate,
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
    showToolManager,
    recallItems,
    isSearchingRecall,
    setShowCostDialog,
    setShowShortcutSheet,
    setShowRecallSheet,
    setShowToolManager,
    handleScroll,
    scrollToBottom,
    handleRecallSearch,
    handleInjectRecall
  } = useAgentUI()

  const { ttsPlayingMsgId, handleTtsReadAloud } = useTTS()
  const { branchSession } = useBranchSession()
  useStreamError(streamError, isStreaming)

  useEffect(() => {
    if (!showShortcutSheet || !dbReady || !services) return
    services.settingsManager
      .get<Array<{ id: string; icon: string; name: string; content: string }>>('prompt_shortcuts')
      .then((items) => setShortcuts(items || []))
      .catch(() => setShortcuts([]))
  }, [showShortcutSheet, dbReady, services])

  const loadAssistants = useCallback(async () => {
    if (!dbReady || !services) return
    try {
      const list =
        (await services.settingsManager.get<
          Array<{
            id: string
            name: string
            description?: string
            emoji?: string
            isPinned?: boolean
            lastUsedAt?: number
          }>
        >('assistants')) || []
      setAssistants(
        list.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          emoji: a.emoji,
          isPinned: Boolean(a.isPinned),
          lastUsedAt: a.lastUsedAt || 0
        }))
      )
    } catch {
      setAssistants([])
    }
  }, [dbReady, services])

  useEffect(() => {
    loadAssistants()
  }, [loadAssistants, drawerOpen, showAssistantPicker])

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
        .map(({ id, name, description, emoji }) => ({ id, name, description, emoji })),
    [assistants]
  )

  const handleSelectAssistantWithTracking = useCallback(
    async (assistant: AssistantSummary) => {
      const full = assistants.find((a) => a.id === assistant.id)
      if (!full) return
      handleSelectAssistant(full as any)
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
        setAssistants(
          updated.map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            emoji: a.emoji,
            isPinned: Boolean(a.isPinned),
            lastUsedAt: a.lastUsedAt || 0
          }))
        )
      } catch {}
    },
    [assistants, handleSelectAssistant, services]
  )

  useEffect(() => {
    if (!showToolManager || !dbReady || !services) return
    services.settingsManager
      .get<{ disabledToolIds?: string[]; customConfigs?: Record<string, Record<string, unknown>> }>(
        'tool_config'
      )
      .then((config) =>
        setToolConfig({
          disabledToolIds: config?.disabledToolIds || [],
          customConfigs: config?.customConfigs || {}
        })
      )
      .catch(() => setToolConfig({ disabledToolIds: [], customConfigs: {} }))
  }, [showToolManager, dbReady, services])

  const handleToolConfigChange = useCallback(
    async (next: {
      disabledToolIds: string[]
      customConfigs: Record<string, Record<string, unknown>>
    }) => {
      setToolConfig(next)
      if (!services) return
      try {
        await services.settingsManager.set('tool_config', next)
      } catch (e) {
        console.warn('Failed to save tool config', e)
      }
    },
    [services]
  )

  const handleShortcutSelect = useCallback(
    (shortcut: { content: string }) => {
      setShowShortcutSheet(false)
      if (shortcut.content.trim()) {
        void handleSend(shortcut.content.trim())
      }
    },
    [handleSend, setShowShortcutSheet]
  )

  const [ttsMode, setTtsMode] = useState<'off' | 'manual' | 'always'>(() => 'manual')
  const ttsModeRef = useRef(ttsMode)
  ttsModeRef.current = ttsMode

  const toggleTtsMode = useCallback(() => {
    setTtsMode((prev) => {
      const nextMap: Record<string, 'off' | 'manual' | 'always'> = {
        off: 'manual',
        manual: 'always',
        always: 'off'
      }
      const next = nextMap[prev] || 'manual'
      AsyncStorage.setItem('baishou_tts_mode', next).catch(() => {})
      return next
    })
  }, [])

  useEffect(() => {
    AsyncStorage.getItem('baishou_tts_mode')
      .then((v) => {
        if (v === 'off' || v === 'manual' || v === 'always') {
          setTtsMode(v)
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
    contextMessages: any[]
    compressedContent?: string
    originalContent?: string
    systemPrompt?: string
  }>({
    visible: false,
    message: {},
    contextMessages: []
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
    (message: any) => {
      let decodedContext: any[] = []
      let compressedContent: string | undefined
      let systemPrompt: string | undefined

      const msgIndex = messages.findIndex((m: any) => m.id === message.id)
      if (msgIndex > 0) {
        const prevMsg = messages[msgIndex - 1]
        if (prevMsg.role === 'user' && prevMsg.parts) {
          const ctxPart = prevMsg.parts.find((p) => p.type === 'context_snapshot')
          const ctxData = ctxPart ? partDataAsRecord(ctxPart.data) : undefined
          const snapshots = ctxData?.snapshots
          if (Array.isArray(snapshots)) {
            decodedContext = snapshots.map((s: Record<string, unknown>) => ({
              role: 'system',
              content: `${s.title ? '[' + String(s.title) + '] ' : ''}${String(s.content ?? '')}`,
              timestamp: message.createdAt || new Date()
            }))
          }

          const compPart = prevMsg.parts.find((p) => p.type === 'compaction')
          const compData = compPart ? partDataAsRecord(compPart.data) : undefined
          if (typeof compData?.summary === 'string') {
            compressedContent = compData.summary
          }
        }

        if (msgIndex === 1 || (msgIndex === 2 && messages[0]?.role === 'system')) {
          const sysMsg = messages.find((m: any) => m.role === 'system')
          if (sysMsg?.content) {
            systemPrompt = sysMsg.content
          }
        }
      }

      setContextDialogState({
        visible: true,
        message,
        contextMessages: decodedContext,
        compressedContent,
        originalContent: message.content,
        systemPrompt
      })
    },
    [messages]
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
  const assistantDisplayName =
    currentAssistant?.name || t('agent.assistant.default_assistant_name', '默认伙伴')
  const chatAiProfile = useMemo(
    () => ({
      name: assistantDisplayName,
      emoji: currentAssistant?.emoji,
      avatarPath: (currentAssistant as { avatarPath?: string | null } | null)?.avatarPath
    }),
    [assistantDisplayName, currentAssistant]
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
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: INPUT_DOCK_HEIGHT + inputOffset + 24 }
            ]}
            data={messages}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            renderItem={({ item }) => (
              <View style={styles.bubble}>
                <ChatBubble
                  message={{
                    id: item.id,
                    role: item.role as any,
                    content: item.content,
                    reasoning: item.reasoning,
                    toolInvocations: item.toolInvocations,
                    attachments: item.attachments,
                    inputTokens: item.inputTokens,
                    outputTokens: item.outputTokens,
                    costMicros: item.costMicros
                  }}
                  userProfile={chatUserProfile}
                  aiProfile={chatAiProfile}
                  onRegenerate={() => handleRegenerate(item.id)}
                  onResend={
                    item.role === 'user'
                      ? () => handleEditMessage(item.id, item.content)
                      : undefined
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
                      ? (content) => handleTtsReadAloud(content, item.id)
                      : undefined
                  }
                  isTtsPlaying={ttsPlayingMsgId === item.id}
                  onShowContext={
                    item.role === 'assistant' ? () => handleShowContext(item) : undefined
                  }
                  onBranch={item.role === 'assistant' ? () => handleBranch(item.id) : undefined}
                />
              </View>
            )}
            ListFooterComponent={
              isStreaming ? (
                <View>
                  <StreamingBubble
                    text={streamingText}
                    reasoning={streamingReasoning}
                    isReasoning={isStreaming && !streamingText && !!streamingReasoning}
                    activeToolName={activeTool?.name ?? null}
                    completedTools={completedTools.map((tool) => ({
                      name: tool.name,
                      durationMs:
                        tool.endTime && tool.startTime ? tool.endTime - tool.startTime : 0
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
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListEmptyComponent={!isStreaming ? renderEmptyState() : null}
          />

          {showScrollButton && (
            <View
              style={[styles.scrollBtnWrap, { bottom: inputOffset + INPUT_DOCK_HEIGHT + 12 }]}
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
            style={[
              styles.inputDock,
              {
                backgroundColor: colors.bgSurface,
                bottom: inputOffset
              }
            ]}
          >
            <InputBar
              onSend={handleSend}
              isLoading={isLoading || isStreaming}
              onStop={handleStop}
              assistantName={assistantDisplayName}
              onTriggerShortcut={() => setShowShortcutSheet(true)}
              onManageShortcuts={() => setShowShortcutSheet(true)}
              onRecall={() => setShowRecallSheet(true)}
              onOpenTools={() => setShowToolManager(true)}
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
                description: (currentAssistant as { description?: string }).description,
                emoji: currentAssistant.emoji
              }
            : null
        }
        pinnedAssistants={pinnedAssistants}
        selectedSessionId={currentSessionId || undefined}
        onSelectSession={handleSelectSession}
        onCreateSession={() => {
          void handleCreateSession()
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
        visible={showCostDialog}
        onClose={() => setShowCostDialog(false)}
        totalTokens={totalInputTokens + totalOutputTokens}
        totalCost={estimatedCost}
        sessionTokens={totalInputTokens + totalOutputTokens}
        sessionCost={estimatedCost}
      />

      <PromptShortcutSheet
        visible={showShortcutSheet}
        onClose={() => setShowShortcutSheet(false)}
        shortcuts={shortcuts}
        onSelect={handleShortcutSelect}
      />

      <RecallDialog
        isOpen={showRecallSheet}
        onClose={() => setShowRecallSheet(false)}
        items={recallItems}
        isSearching={isSearchingRecall}
        onSearch={handleRecallSearch}
        onInject={handleInjectRecall}
      />

      <Modal
        visible={showToolManager}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowToolManager(false)}
      >
        <ScreenSafeArea preset="modal" style={{ backgroundColor: colors.bgApp }}>
          <View style={[styles.toolModalHeader, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.toolModalTitle, { color: colors.textPrimary }]}>
              {t('settings.agent_tools_title', '工具管理')}
            </Text>
            <Pressable onPress={() => setShowToolManager(false)}>
              <Text style={[styles.toolModalClose, { color: colors.textSecondary }]}>
                {t('common.close', '关闭')}
              </Text>
            </Pressable>
          </View>
          <AgentToolsView config={toolConfig} onChange={handleToolConfigChange} />
        </ScreenSafeArea>
      </Modal>

      <ContextChainDialog
        visible={contextDialogState.visible}
        onClose={() => setContextDialogState((prev) => ({ ...prev, visible: false }))}
        message={contextDialogState.message}
        contextMessages={contextDialogState.contextMessages}
        compressedContent={contextDialogState.compressedContent}
        originalContent={contextDialogState.originalContent}
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
  listContent: { paddingVertical: 24, paddingHorizontal: 16, flexGrow: 1 },
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
  },
  toolModal: {
    flex: 1
  },
  toolModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1
  },
  toolModalTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  toolModalClose: {
    fontSize: 16,
    fontWeight: '600'
  }
})
