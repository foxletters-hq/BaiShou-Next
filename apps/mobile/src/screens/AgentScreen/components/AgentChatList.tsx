import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, StyleSheet, TouchableOpacity, Text, ImageBackground, ScrollView } from 'react-native'
import { InputBar } from '@baishou/ui/native'
import {
  collectAgentGatePartDataForSurface,
  collectUnresolvedAgentGateRequestsForSurface
} from '@baishou/shared'
import { selectResolvedLiveForSession, useAgentGateInboxStore } from '@baishou/store'
import { listPendingMobileAgentGate } from '../../../services/mobile-agent-gate.service'

import { mobileComposerDraftStorage } from '../../../lib/mobile-composer-draft.storage'
import {
  loadChatBackgroundLuminance,
  peekChatBackgroundLuminance,
  resolveChatBackgroundMetaTone
} from '../../../lib/chat-background-luminance.util'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { ChevronDown } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { AgentChatAppBar } from '../../../components/AgentChatAppBar'
import { AgentMessageRow } from '../../../components/AgentMessageRow'
import { AgentDrawerSwipeZone } from '../../../components/AgentDrawerSwipeZone'
import { logAgentScrollEvent } from '../../../utils/agent-scroll-diagnostics'
import { INPUT_DOCK_HEIGHT, LIVE_ASSISTANT_STREAM_KEY } from '../agent-screen.constants'
import { agentScreenStyles as styles } from '../agent-screen.styles'
import { MobileNotebookMountSheet } from './MobileNotebookMountSheet'
import { KnowledgeMountHintBar } from './KnowledgeMountHintBar'
import { useSessionReasoningEffort } from './useSessionReasoningEffort'
import type { AgentChatListProps } from './agent-chat-list.types'

export type { AgentChatListProps } from './agent-chat-list.types'

const KNOWLEDGE_ENTRY_ENABLED = false

export function AgentChatList(props: AgentChatListProps) {
  const p = props
  const [notebookMountOpen, setNotebookMountOpen] = useState(false)
  const dockHeightDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentDockHeightRef = useRef(p.inputDockHeight)
  currentDockHeightRef.current = p.inputDockHeight
  const streamTailTimestampRef = useRef<Date>(new Date())
  const prevHasStreamTailRef = useRef(false)
  const hasStreamTailRow = p.chatRows[p.chatRows.length - 1]?.kind === 'stream-tail'
  if (hasStreamTailRow && !prevHasStreamTailRef.current) {
    streamTailTimestampRef.current = new Date()
  }
  prevHasStreamTailRef.current = hasStreamTailRow

  const [bgLuminance, setBgLuminance] = useState<number | null>(() =>
    peekChatBackgroundLuminance(p.resolvedChatBackgroundUri)
  )

  useEffect(() => {
    if (!p.resolvedChatBackgroundUri) {
      setBgLuminance(null)
      return
    }
    const cached = peekChatBackgroundLuminance(p.resolvedChatBackgroundUri)
    if (cached !== null) {
      setBgLuminance(cached)
      return
    }
    let cancelled = false
    void loadChatBackgroundLuminance(p.resolvedChatBackgroundUri).then((lum) => {
      if (!cancelled) {
        setBgLuminance(lum)
      }
    })
    return () => {
      cancelled = true
    }
  }, [p.resolvedChatBackgroundUri])

  const chatBackgroundMetaTone = useMemo(() => {
    if (!p.hasChatBackground) return false as const
    return resolveChatBackgroundMetaTone({
      luminance: bgLuminance,
      overlayOpacity: p.chatBackgroundOverlay,
      isDarkTheme: p.isDark
    })
  }, [p.hasChatBackground, bgLuminance, p.chatBackgroundOverlay, p.isDark])

  useEffect(() => {
    return () => {
      if (dockHeightDebounceRef.current) {
        clearTimeout(dockHeightDebounceRef.current)
      }
    }
  }, [])
  const reasoningEffort = useSessionReasoningEffort({
    sessionId: p.currentSessionId ?? null,
    providerId: p.currentProviderId,
    providerType: p.currentProviderType,
    modelId: p.currentModelId ?? null
  })
  const resolvedLive = useAgentGateInboxStore((state) =>
    selectResolvedLiveForSession(state, p.currentSessionId, 'companion')
  )
  useEffect(() => {
    const liveIds = new Set(
      listPendingMobileAgentGate(p.currentSessionId ?? undefined).map((item) => item.id)
    )
    for (const msg of p.messages ?? []) {
      for (const request of collectUnresolvedAgentGateRequestsForSurface(msg.parts, 'companion')) {
        if (!liveIds.has(request.id)) continue
        useAgentGateInboxStore.getState().upsertAsked(request, { respectTombstone: true })
      }
    }
  }, [p.messages, p.currentSessionId])
  const liveGateParts = useMemo(() => {
    const persisted = new Set<string>()
    for (const msg of p.messages ?? []) {
      for (const data of collectAgentGatePartDataForSurface(msg.parts, 'companion')) {
        persisted.add(data.request.id)
      }
    }
    return resolvedLive.filter((item) => !persisted.has(item.request.id))
  }, [p.messages, resolvedLive])
  const scrollButtonVisible = p.showScrollButton && !p.isBubbleEditing
  const scrollButtonOpacity = useSharedValue(scrollButtonVisible ? 1 : 0)
  useEffect(() => {
    scrollButtonOpacity.value = scrollButtonVisible ? 1 : 0
  }, [scrollButtonOpacity, scrollButtonVisible])
  const scrollButtonVisibilityStyle = useAnimatedStyle(() => ({
    opacity: scrollButtonOpacity.value,
    display: scrollButtonOpacity.value <= 0.001 ? ('none' as const) : ('flex' as const)
  }))
  const ChatBackgroundWrapper = (
    p.resolvedChatBackgroundUri ? ImageBackground : View
  ) as typeof View
  const chatBackgroundWrapperProps = p.resolvedChatBackgroundUri
    ? {
        source: { uri: p.resolvedChatBackgroundUri },
        resizeMode: 'cover' as const,
        imageStyle: styles.backgroundImageInner,
        blurRadius: p.chatBackgroundBlur,
        fadeDuration: 0
      }
    : {}

  return (
    <ChatBackgroundWrapper
      key={p.userProfile.chatBackgroundPath ?? 'default-chat-bg'}
      style={styles.backgroundImage}
      {...chatBackgroundWrapperProps}
    >
      {p.resolvedChatBackgroundUri && p.chatBackgroundOverlay > 0 ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: `rgba(0, 0, 0, ${p.chatBackgroundOverlay / 100})` }
          ]}
        />
      ) : null}
      <View style={styles.container}>
        <AgentChatAppBar
          title={p.assistantDisplayName || p.t('nav.agent', '伙伴')}
          avatarUri={p.assistantAvatarUri ?? p.chatAiProfile?.resolvedAvatarUri}
          avatarPath={p.assistantAvatarPath}
          avatarEmoji={p.assistantEmoji}
          costMicros={p.totalCostMicros}
          hasChatBackground={p.hasChatBackground}
          onMenuPress={() => p.setDrawerOpen(true)}
          onCostPress={() => p.setShowCostDialog(true)}
        />

        <AgentDrawerSwipeZone enabled={p.drawerSwipeEnabled} onOpen={() => p.setDrawerOpen(true)}>
          <ScrollView
            ref={p.flatListRef}
            style={styles.list}
            contentContainerStyle={p.listContentStyle}
            nestedScrollEnabled
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            onLayout={(event) => {
              const height = Math.ceil(event.nativeEvent.layout.height)
              if (height > 0) {
                p.setListViewportHeight((prev) => (prev === height ? prev : height))
              }
              if (!p.layoutReadyRef.current) {
                p.layoutReadyRef.current = true
                if (p.messages.length > 0) {
                  requestAnimationFrame(() => {
                    logAgentScrollEvent('layout_scroll_to_end', {
                      messagesCount: p.messages.length,
                      viewportH: height
                    })
                    p.flatListRef.current?.scrollToEnd({ animated: false })
                  })
                }
              }
            }}
            onScroll={p.handleListScroll}
            onScrollBeginDrag={p.handleScrollBeginDrag}
            onScrollEndDrag={p.handleScrollEndDrag}
            onMomentumScrollBegin={p.handleMomentumScrollBegin}
            onMomentumScrollEnd={p.handleMomentumScrollEnd}
            onContentSizeChange={p.handleListContentSizeChange}
            scrollEventThrottle={16}
          >
            <View
              collapsable={false}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout
                const totalHeight = Math.ceil(y + height)
                if (totalHeight > 0) p.handleListIntrinsicContentHeightChange(totalHeight)
              }}
            >
              {p.hasMore && p.showLoadMoreBanner ? (
                <TouchableOpacity
                  style={[
                    styles.loadMore,
                    {
                      borderColor: p.colors.borderSubtle,
                      backgroundColor: p.colors.bgSurface
                    }
                  ]}
                  onPress={() => void p.handleLoadMore()}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.loadMoreText, { color: p.colors.primary }]}>
                    {p.t('agent.chat.load_earlier_messages', '加载更早对话')}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {!p.isStreaming && !p.isStreamBridgeActive && p.messages.length === 0
                ? p.renderEmptyState(chatBackgroundMetaTone)
                : null}

              {p.chatRows.map((row) => {
                if (row.kind === 'stream-tail') {
                  if (!p.hasStreamingBody) {
                    return p.renderStreamingDots(chatBackgroundMetaTone)
                  }
                }

                const item = row.kind === 'message' ? row.item : null
                if (!item) {
                  const tailItem = {
                    id: LIVE_ASSISTANT_STREAM_KEY,
                    role: 'assistant' as const,
                    content: p.streamingText,
                    reasoning: p.streamingReasoning,
                    timestamp: streamTailTimestampRef.current
                  }
                  return (
                    <View key={LIVE_ASSISTANT_STREAM_KEY} collapsable={false} style={styles.bubble}>
                      <AgentMessageRow
                        item={tailItem as any}
                        chatUserProfile={p.chatUserProfile}
                        chatAiProfile={p.chatAiProfile}
                        isLiveCompressionAnchor={false}
                        liveCompression={p.IDLE_LIVE_COMPRESSION}
                        liveStream={{ ...p.liveStreamProps, gateParts: liveGateParts }}
                        deferAssistantChrome
                        onRegenerate={() => {}}
                        onCopy={() => {}}
                        onDelete={() => {}}
                        invertMetaOverBackground={chatBackgroundMetaTone}
                        hasChatBackground={p.hasChatBackground}
                        error={p.streamError ?? null}
                        retryDisabled
                      />
                    </View>
                  )
                }

                const msgWithCompaction = item as typeof item & {
                  compactionRecord?: { streamTranscript?: string } | null
                }
                const isLiveCompressionAnchor =
                  (p.compressionPhase === 'auto' || p.compressionPhase === 'manual') &&
                  p.compressionTriggerMessageId === item.id &&
                  p.isCompressing

                const liveCompression = isLiveCompressionAnchor
                  ? {
                      phase: p.compressionPhase,
                      summary: p.compressionText,
                      reasoning: p.compressionReasoning,
                      isActive: p.isCompressing
                    }
                  : p.IDLE_LIVE_COMPRESSION

                const isLastAssistant = item.role === 'assistant' && item.id === p.lastMessage?.id
                const isLiveAssistantRow =
                  isLastAssistant && (p.liveAssistantActive || p.keepLiveRowAfterHold)
                const rowKey = isLastAssistant ? LIVE_ASSISTANT_STREAM_KEY : item.id

                const rowLiveStream = isLiveAssistantRow
                  ? {
                      content: p.markdownPresentationActive
                        ? p.streamingText.trim() || item.content
                        : item.content,
                      reasoning: p.markdownPresentationActive
                        ? p.streamingReasoning.trim() || item.reasoning || ''
                        : item.reasoning || '',
                      isTextStreaming: p.markdownPresentationActive && p.bubbleTextStreaming,
                      isThinkLoading: p.markdownPresentationActive && p.streamingThinkLoading,
                      isThinkStreaming:
                        p.markdownPresentationActive && Boolean(p.streamingReasoning.trim()),
                      timeline: p.liveStreamProps.timeline,
                      gateParts: liveGateParts,
                      activeToolName: p.markdownPresentationActive ? p.activeToolDisplayName : null,
                      completedTools: p.liveStreamProps.completedTools,
                      attachments: p.liveStreamProps.attachments,
                      error: p.streamError ?? p.liveStreamProps.error ?? null
                    }
                  : undefined

                const deferChromeForRow = isLiveAssistantRow && p.markdownPresentationActive

                return (
                  <View
                    key={rowKey}
                    ref={item.id === p.editingMessageId ? p.editingRowRef : undefined}
                    collapsable={false}
                    style={styles.bubble}
                  >
                    <AgentMessageRow
                      item={msgWithCompaction as any}
                      chatUserProfile={p.chatUserProfile}
                      chatAiProfile={p.chatAiProfile}
                      isLiveCompressionAnchor={isLiveCompressionAnchor}
                      liveCompression={liveCompression}
                      liveStream={rowLiveStream}
                      deferAssistantChrome={deferChromeForRow}
                      onRegenerate={() => p.handleRegenerate(item.id)}
                      onResend={
                        item.role === 'user' ? () => void p.handleResend(item.id) : undefined
                      }
                      onResendEdit={
                        item.role === 'user'
                          ? (content) => p.handleEditMessage(item.id, content)
                          : undefined
                      }
                      onSaveEdit={
                        item.role === 'assistant'
                          ? (content) => p.handleSaveAssistantEdit(item.id, content)
                          : undefined
                      }
                      onCopy={() => Clipboard.setStringAsync(item.content)}
                      onDelete={() => p.handleDeleteMessage(item.id)}
                      onReadAloud={
                        item.role === 'assistant'
                          ? () => p.handleTtsReadAloud(item.content, item.id)
                          : undefined
                      }
                      isTtsPlaying={p.ttsPlayingMsgId === item.id}
                      onShowContext={
                        item.role === 'assistant' ? () => p.handleShowContext(item) : undefined
                      }
                      onBranch={
                        item.role === 'assistant' ? () => p.handleBranch(item.id) : undefined
                      }
                      onBubbleEditingChange={p.handleBubbleEditingChange}
                      invertMetaOverBackground={chatBackgroundMetaTone}
                      hasChatBackground={p.hasChatBackground}
                      retryDisabled={
                        p.isRetryActionBusy ||
                        p.isStreaming ||
                        p.isCompressing ||
                        p.markdownPresentationActive
                      }
                      error={isLastAssistant ? (p.streamError ?? null) : null}
                    />
                  </View>
                )
              })}

              {p.listFooter}
            </View>
          </ScrollView>
        </AgentDrawerSwipeZone>

        <Animated.View
          pointerEvents={scrollButtonVisible ? 'box-none' : 'none'}
          style={[styles.scrollBtnWrap, p.scrollButtonAnimatedStyle, scrollButtonVisibilityStyle]}
        >
          <TouchableOpacity
            activeOpacity={0.78}
            style={[
              styles.scrollBtn,
              {
                backgroundColor: p.hasChatBackground
                  ? p.isDark
                    ? 'rgba(38, 39, 44, 0.94)'
                    : 'rgba(255, 255, 255, 0.96)'
                  : p.isDark
                    ? p.colors.bgSurfaceHigh
                    : p.colors.bgSurface,
                borderColor: p.hasChatBackground
                  ? p.isDark
                    ? 'rgba(255, 255, 255, 0.24)'
                    : 'rgba(0, 0, 0, 0.14)'
                  : p.colors.borderStrong
              }
            ]}
            onPress={() => p.scrollToBottom(p.flatListRef, true)}
            accessibilityRole="button"
            accessibilityLabel={p.t('agent.chat.scroll_to_bottom', '回到最新消息')}
            accessible={scrollButtonVisible}
          >
            <ChevronDown size={22} color={p.colors.textPrimary} strokeWidth={2.25} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          onLayout={(event) => {
            const next = Math.ceil(event.nativeEvent.layout.height)
            if (next <= 0 || Math.abs(next - currentDockHeightRef.current) < 2) return

            // 初次挂载或重置高度时立即生效，避免初始布局跳动
            if (currentDockHeightRef.current === INPUT_DOCK_HEIGHT) {
              p.setInputDockHeight(next)
              return
            }

            // 动画开合与尺寸频繁过渡期间防抖，避免逐帧触发根页面与消息流重渲染
            if (dockHeightDebounceRef.current) {
              clearTimeout(dockHeightDebounceRef.current)
            }
            dockHeightDebounceRef.current = setTimeout(() => {
              if (Math.abs(next - currentDockHeightRef.current) >= 2) {
                p.setInputDockHeight(next)
              }
            }, 60)
          }}
          style={[styles.inputDock, p.inputDockAnimatedStyle]}
          pointerEvents={p.isBubbleEditing ? 'none' : 'auto'}
        >
          {KNOWLEDGE_ENTRY_ENABLED ? (
            <KnowledgeMountHintBar
              sessionId={p.currentSessionId}
              assistantId={p.assistantId}
              refreshToken={notebookMountOpen}
              hasChatBackground={p.hasChatBackground}
              onOpen={() => setNotebookMountOpen(true)}
            />
          ) : null}
          <InputBar
            ref={p.inputBarRef}
            hasChatBackground={p.hasChatBackground}
            onSend={p.handleSendWithScroll}
            isLoading={p.isLoading || p.isStreaming}
            onStop={p.handleStop}
            composerBlocked={!p.hasConfiguredDialogueModel}
            onComposerBlocked={() =>
              p.toast.showInfo(p.t('agent.error.no_model', '请先在输入栏选择一个模型'))
            }
            composerDraftKey={p.composerDraftKey}
            composerDraftStorage={mobileComposerDraftStorage}
            composerEnabled={!p.isBubbleEditing}
            reasoningEffort={reasoningEffort}
            modelSelector={
              p.handleSelectModel
                ? {
                    currentProviderId: p.currentProviderId,
                    currentModelId: p.currentModelId,
                    currentProviderType: p.currentProviderType,
                    displayModelName: p.displayModelName,
                    providers: p.dialogueProviders || [],
                    onSelectModel: p.handleSelectModel,
                    onManageProviders: () => (p.router as any).push('/settings/ai-services'),
                    reasoningEffort
                  }
                : undefined
            }
            onInputFocus={p.handleInputBarFocus}
            shortcuts={p.shortcuts}
            assistantName={p.assistantDisplayName}
            onManageShortcuts={() => p.setShowShortcutSheet(true)}
            onRecall={() => p.setShowRecallSheet(true)}
            onOpenNotebookMount={
              KNOWLEDGE_ENTRY_ENABLED ? () => setNotebookMountOpen(true) : undefined
            }
            onOpenTools={() => p.router.push('/settings/agent-tools')}
            searchMode={p.searchMode}
            onToggleSearchMode={p.toggleSearchMode}
            ttsMode={p.ttsMode}
            onToggleTtsMode={p.toggleTtsMode}
          />
        </Animated.View>
        {KNOWLEDGE_ENTRY_ENABLED ? (
          <MobileNotebookMountSheet
            visible={notebookMountOpen}
            sessionId={p.currentSessionId}
            assistantId={p.assistantId}
            onClose={() => setNotebookMountOpen(false)}
          />
        ) : null}
      </View>
    </ChatBackgroundWrapper>
  )
}
