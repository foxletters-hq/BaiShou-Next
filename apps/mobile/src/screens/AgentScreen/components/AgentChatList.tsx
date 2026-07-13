import React from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ImageBackground,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from 'react-native'
import { InputBar } from '@baishou/ui/native'

type ComposerOnSend = (
  text: string,
  attachments?: unknown[],
  searchMode?: boolean
) => boolean | Promise<boolean>
import { mobileComposerDraftStorage } from '../../../lib/mobile-composer-draft.storage'
import Animated from 'react-native-reanimated'
import { ChevronDown } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { AgentChatAppBar } from '../../../components/AgentChatAppBar'
import { AgentMessageRow } from '../../../components/AgentMessageRow'
import { AgentDrawerSwipeZone } from '../../../components/AgentDrawerSwipeZone'
import { logAgentScrollEvent } from '../../../utils/agent-scroll-diagnostics'
import { LIVE_ASSISTANT_STREAM_KEY } from '../agent-screen.constants'
import { agentScreenStyles as styles } from '../agent-screen.styles'

export type AgentChatListProps = {
  colors: any
  isDark: boolean
  t: (key: string, fallback?: string) => string
  resolvedChatBackgroundUri: string | null | undefined
  chatBackgroundBlur: number
  chatBackgroundOverlay: number
  userProfile: { chatBackgroundPath?: string | null }
  displayModelName: string | null
  currentProviderId: string | null
  currentProviderType: string | undefined
  totalCostMicros: number
  setDrawerOpen: (open: boolean) => void
  setShowModelSwitcher: (v: boolean) => void
  setShowCostDialog: (v: boolean) => void
  drawerSwipeEnabled: boolean
  flatListRef: React.RefObject<ScrollView | null>
  listContentStyle: any
  handleListScroll: (event: any) => void
  handleScrollBeginDrag: () => void
  handleScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleMomentumScrollBegin: () => void
  handleMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleListContentSizeChange: (width: number, height: number) => void
  handleListIntrinsicContentHeightChange: (height: number) => void
  listViewportHeight: number
  setListViewportHeight: React.Dispatch<React.SetStateAction<number>>
  layoutReadyRef: React.RefObject<boolean>
  messages: any[]
  hasMore: boolean
  showLoadMoreBanner: boolean
  handleLoadMore: () => Promise<void> | void
  isStreaming: boolean
  isStreamBridgeActive: boolean
  renderEmptyState: () => React.ReactNode
  chatRows: Array<{ kind: 'message'; item: any } | { kind: 'stream-tail' }>
  hasStreamingBody: boolean
  renderStreamingDots: () => React.ReactNode
  streamingText: string
  streamingReasoning: string
  chatUserProfile: any
  chatAiProfile: any
  hasChatBackground: boolean
  liveStreamProps: any
  compressionPhase: string
  compressionTriggerMessageId: string | null | undefined
  isCompressing: boolean
  compressionText: string
  compressionReasoning: string
  IDLE_LIVE_COMPRESSION: any
  lastMessage: any
  liveAssistantActive: boolean
  keepLiveRowAfterHold: boolean
  markdownPresentationActive: boolean
  bubbleTextStreaming: boolean
  streamingThinkLoading: boolean
  activeToolDisplayName: string | null
  streamingCompletedTools: any[]
  editingMessageId: string | null
  editingRowRef: React.RefObject<View | null>
  handleRegenerate: (id: string) => void
  handleResend: (id: string) => Promise<void> | void
  handleEditMessage: (id: string, content: string) => void
  handleSaveAssistantEdit: (id: string, content: string) => void
  handleDeleteMessage: (id: string) => void
  handleTtsReadAloud: (content: string, id: string) => void
  ttsPlayingMsgId: string | null
  handleShowContext: (message: any) => void
  handleBranch: (id: string) => void
  handleBubbleEditingChange: (editing: boolean, messageId?: string) => void
  isRetryActionBusy: boolean
  listFooter: React.ReactNode
  showScrollButton: boolean
  isBubbleEditing: boolean
  scrollButtonAnimatedStyle: any
  scrollToBottom: (ref: React.RefObject<ScrollView | null>, animated: boolean) => void
  inputDockHeight: number
  setInputDockHeight: React.Dispatch<React.SetStateAction<number>>
  inputDockAnimatedStyle: any
  inputBarRef: React.RefObject<any>
  handleSendWithScroll: ComposerOnSend
  isLoading: boolean
  handleStop: () => void
  hasConfiguredDialogueModel: boolean
  toast: { showInfo: (msg: string) => void }
  composerDraftKey: string
  handleInputBarFocus: () => void
  shortcuts: any[]
  assistantDisplayName: string
  setShowShortcutSheet: (v: boolean) => void
  setShowRecallSheet: (v: boolean) => void
  router: { push: (href: '/settings/agent-tools') => void }
  searchMode: boolean
  toggleSearchMode: () => void
  ttsMode: 'manual' | 'always'
  toggleTtsMode: () => void
}

export function AgentChatList(props: AgentChatListProps) {
  const p = props
  const ChatBackgroundWrapper = (
    p.resolvedChatBackgroundUri ? ImageBackground : View
  ) as typeof View
  const chatBackgroundWrapperProps = p.resolvedChatBackgroundUri
    ? {
        source: { uri: p.resolvedChatBackgroundUri },
        resizeMode: 'cover' as const,
        imageStyle: styles.backgroundImageInner,
        blurRadius: p.chatBackgroundBlur
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
          modelName={p.displayModelName || ''}
          providerId={p.currentProviderId}
          providerType={p.currentProviderType}
          costMicros={p.totalCostMicros}
          onMenuPress={() => p.setDrawerOpen(true)}
          onModelPress={() => p.setShowModelSwitcher(true)}
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
                const height = Math.ceil(event.nativeEvent.layout.height)
                if (height > 0) p.handleListIntrinsicContentHeightChange(height)
              }}
            >
            {p.hasMore && p.showLoadMoreBanner ? (
              <TouchableOpacity
                style={[
                  styles.loadMore,
                  {
                    borderColor: p.colors.borderSubtle,
                    backgroundColor: p.colors.bgGlassSurface ?? p.colors.bgSurface
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
              ? p.renderEmptyState()
              : null}

            {p.chatRows.map((row) => {
              if (row.kind === 'stream-tail') {
                if (!p.hasStreamingBody) {
                  return p.renderStreamingDots()
                }
              }

              const item = row.kind === 'message' ? row.item : null
              if (!item) {
                const tailItem = {
                  id: LIVE_ASSISTANT_STREAM_KEY,
                  role: 'assistant' as const,
                  content: p.streamingText,
                  reasoning: p.streamingReasoning
                }
                return (
                  <View key={LIVE_ASSISTANT_STREAM_KEY} style={styles.bubble}>
                    <AgentMessageRow
                      item={tailItem as any}
                      chatUserProfile={p.chatUserProfile}
                      chatAiProfile={p.chatAiProfile}
                      isLiveCompressionAnchor={false}
                      liveCompression={p.IDLE_LIVE_COMPRESSION}
                      liveStream={p.liveStreamProps}
                      deferAssistantChrome
                      onRegenerate={() => {}}
                      onCopy={() => {}}
                      onDelete={() => {}}
                      invertMetaOverBackground={p.hasChatBackground}
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
                    isThinkStreaming: false,
                    activeToolName: p.markdownPresentationActive ? p.activeToolDisplayName : null,
                    completedTools: p.markdownPresentationActive ? p.streamingCompletedTools : [],
                    attachments: p.liveStreamProps.attachments
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
                    onResend={item.role === 'user' ? () => void p.handleResend(item.id) : undefined}
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
                    onBranch={item.role === 'assistant' ? () => p.handleBranch(item.id) : undefined}
                    onBubbleEditingChange={p.handleBubbleEditingChange}
                    invertMetaOverBackground={p.hasChatBackground}
                    retryDisabled={p.isRetryActionBusy || p.isStreaming || p.isCompressing}
                  />
                </View>
              )
            })}

            {p.listFooter}
            </View>
          </ScrollView>
        </AgentDrawerSwipeZone>

        {p.showScrollButton && !p.isBubbleEditing ? (
          <Animated.View
            pointerEvents="box-none"
            style={[styles.scrollBtnWrap, p.scrollButtonAnimatedStyle]}
          >
            <TouchableOpacity
              style={[styles.scrollBtn, { backgroundColor: p.colors.bgSurface }]}
              onPress={() => p.scrollToBottom(p.flatListRef, true)}
              accessibilityLabel={p.t('agent.chat.scroll_to_bottom', '回到最新消息')}
            >
              <ChevronDown size={22} color={p.colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        <Animated.View
          onLayout={(event) => {
            const next = Math.ceil(event.nativeEvent.layout.height)
            if (next > 0 && next !== p.inputDockHeight) p.setInputDockHeight(next)
          }}
          style={[styles.inputDock, p.inputDockAnimatedStyle]}
          pointerEvents={p.isBubbleEditing ? 'none' : 'auto'}
        >
          <InputBar
            ref={p.inputBarRef}
            onSend={p.handleSendWithScroll}
            isLoading={p.isLoading || p.isStreaming}
            onStop={p.handleStop}
            composerBlocked={!p.hasConfiguredDialogueModel}
            onComposerBlocked={() =>
              p.toast.showInfo(p.t('agent.error.no_model', '请先在顶部选择一个模型'))
            }
            composerDraftKey={p.composerDraftKey}
            composerDraftStorage={mobileComposerDraftStorage}
            composerEnabled={!p.isBubbleEditing}
            onInputFocus={p.handleInputBarFocus}
            onHeightChange={(height) => {
              if (height > 0 && height !== p.inputDockHeight) p.setInputDockHeight(height)
            }}
            shortcuts={p.shortcuts}
            assistantName={p.assistantDisplayName}
            onManageShortcuts={() => p.setShowShortcutSheet(true)}
            onRecall={() => p.setShowRecallSheet(true)}
            onOpenTools={() => p.router.push('/settings/agent-tools')}
            searchMode={p.searchMode}
            onToggleSearchMode={p.toggleSearchMode}
            ttsMode={p.ttsMode}
            onToggleTtsMode={p.toggleTtsMode}
          />
        </Animated.View>
      </View>
    </ChatBackgroundWrapper>
  )
}
