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
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import {
  ChatBubble,
  InputBar,
  StreamingBubble,
  RecallDialog,
  ChatCostDialog,
  PromptShortcutSheet,
  AgentToolsView
} from '@baishou/ui/native'
import { useNativeTheme, useNativeToast } from '@baishou/ui/native'
import { useAgentStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'

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
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import { useStreamError } from '../hooks/useStreamError'

/** 底部输入栏 + 工具条的大致高度，用于列表留白与悬浮按钮定位 */
const INPUT_DOCK_HEIGHT = 136

export const AgentScreen = () => {
  const { t } = useTranslation()
  const { isLoading, searchMode, toggleSearchMode } = useAgentStore()
  const { colors, isDark } = useNativeTheme()
  const { inset: keyboardInset, prepareForKeyboard } = useKeyboardInset()
  const inputDockStyle = useAnimatedStyle(() => ({
    bottom: keyboardInset.value
  }))
  const scrollBtnStyle = useAnimatedStyle(() => ({
    bottom: keyboardInset.value + INPUT_DOCK_HEIGHT + 12
  }))
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
          }>
        >('assistants')) || []
      setAssistants(
        list.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          emoji: a.emoji,
          isPinned: Boolean(a.isPinned)
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

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages])

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
              { paddingBottom: INPUT_DOCK_HEIGHT + 24 }
            ]}
            data={messages}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            renderItem={({ item }) => (
              <View style={styles.bubble}>
                <ChatBubble
                  message={{
                    role: item.role as any,
                    content: item.content,
                    toolInvocations: item.toolInvocations,
                    attachments: item.attachments,
                    inputTokens: item.inputTokens,
                    outputTokens: item.outputTokens,
                    isReasoning: item.isReasoning,
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
                  {(activeTool || completedTools.length > 0) && (
                    <View
                      style={[
                        styles.toolStatusContainer,
                        { backgroundColor: colors.bgSurfaceNormal }
                      ]}
                    >
                      {completedTools.map((tool, index) => (
                        <View key={index} style={styles.toolItem}>
                          <MaterialIcons name="check" size={14} color={colors.accentGreen} />
                          <Text style={[styles.toolName, { color: colors.textSecondary }]}>
                            {tool.name}
                          </Text>
                        </View>
                      ))}
                      {activeTool && (
                        <View style={styles.toolItem}>
                          <MaterialIcons name="sync" size={14} color={colors.primary} />
                          <Text style={[styles.toolNameActive, { color: colors.textPrimary }]}>
                            {activeTool.name}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  <StreamingBubble
                    text={streamingText}
                    reasoning={streamingReasoning}
                    isReasoning={isStreaming && !streamingText && !!streamingReasoning}
                    aiProfile={chatAiProfile}
                  />
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListEmptyComponent={!isStreaming ? renderEmptyState() : null}
          />

          {showScrollButton && (
            <Animated.View style={[styles.scrollBtnWrap, scrollBtnStyle]}>
              <TouchableOpacity
                style={[styles.scrollBtn, { backgroundColor: colors.bgSurface }]}
                onPress={() => scrollToBottom(flatListRef, true)}
                accessibilityLabel={t('agent.chat.scroll_to_bottom', '回到最新消息')}
              >
                <MaterialIcons name="keyboard-arrow-down" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>
          )}

          <Animated.View
            style={[
              styles.inputDock,
              { backgroundColor: colors.bgSurface },
              inputDockStyle
            ]}
          >
            <InputBar
              onInputFocus={prepareForKeyboard}
              onSend={handleSend}
              isLoading={isLoading}
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
          </Animated.View>
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
          const full = assistants.find((a) => a.id === assistant.id)
          if (full) {
            handleSelectAssistant(full as any)
          }
        }}
        onPinSession={handlePinSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
      />

      <AssistantPicker
        isVisible={showAssistantPicker}
        onClose={() => setShowAssistantPicker(false)}
        onSelect={handleSelectAssistant}
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
