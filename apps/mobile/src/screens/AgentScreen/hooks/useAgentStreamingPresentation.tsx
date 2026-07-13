import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { View, Text } from 'react-native'
import Animated from 'react-native-reanimated'
import { Sparkles } from 'lucide-react-native'
import { StreamingBubble } from '@baishou/ui/native'
import {
  logAgentScrollEvent,
  logAgentUiEvent,
  setAgentScrollDebugContext
} from '../../../utils/agent-scroll-diagnostics'
import {
  HOLD_LIVE_PRESENTATION_MS,
  IDLE_LIVE_COMPRESSION,
  LIVE_ASSISTANT_STREAM_KEY
} from '../agent-screen.constants'
import { agentScreenStyles as styles } from '../agent-screen.styles'
import type { useAgentStream } from '../../../hooks/useAgentStream'

type Stream = ReturnType<typeof useAgentStream>

export function useAgentStreamingPresentation(deps: {
  currentSessionId: string | null
  messages: Array<{
    id: string
    role: string
    content?: string
    reasoning?: string
    toolInvocations?: unknown[]
    attachments?: unknown[]
  }>
  scrollOffsetRef: React.RefObject<number>
  isStreaming: Stream['isStreaming']
  isStreamBridgeActive: Stream['isStreamBridgeActive']
  streamPresentationLinger: Stream['streamPresentationLinger']
  isCompressing: Stream['isCompressing']
  compressionPhase: Stream['compressionPhase']
  compressionText: Stream['compressionText']
  compressionReasoning: Stream['compressionReasoning']
  compressionTriggerMessageId: Stream['compressionTriggerMessageId']
  streamingText: Stream['streamingText']
  streamingReasoning: Stream['streamingReasoning']
  activeTool: Stream['activeTool']
  completedTools: Stream['completedTools']
  activeToolDisplayName: string | null
  pendingEmojiAttachments: Array<{
    id: string
    fileName: string
    filePath: string
    isImage: boolean
    isPdf: boolean
  }>
  chatAiProfile: {
    name: string
    emoji?: string
    avatarPath?: string | null
    resolvedAvatarUri?: string | null
  }
  hasChatBackground: boolean
  beginContentHandoff: () => void
  finalizeContentHandoff: () => void
  listViewportHeight: number
  contentAnchorMinHeight: number | null | undefined
  listSpacerAnimatedStyle: object
  colors: { primary: string; textPrimary: string; textSecondary: string }
  t: (key: string, fallback?: string) => string
}) {
  const {
    currentSessionId,
    messages,
    scrollOffsetRef,
    isStreaming,
    isStreamBridgeActive,
    streamPresentationLinger,
    isCompressing,
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
    t
  } = deps

  const [holdLivePresentation, setHoldLivePresentation] = useState(false)
  const [keepLiveRowAfterHold, setKeepLiveRowAfterHold] = useState(false)

  const showStreamingFooter = isStreaming || isStreamBridgeActive

  const lastMessage = messages[messages.length - 1]
  /** 对齐桌面 AgentMessageList：助手已落库后改由列表 ChatBubble 展示，不再挂 Footer StreamingBubble */
  const assistantPersistedInList = useMemo(() => {
    if (lastMessage?.role !== 'assistant') return false
    return Boolean(
      lastMessage.content?.trim() ||
      lastMessage.reasoning?.trim() ||
      (lastMessage.toolInvocations?.length ?? 0) > 0 ||
      (lastMessage.attachments?.length ?? 0) > 0
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
  }, [showStreamingBubble, assistantPersistedInList, messages.length, scrollOffsetRef])

  const prevShowStreamingFooterRef = useRef(showStreamingFooter)
  useEffect(() => {
    if (prevShowStreamingFooterRef.current === showStreamingFooter) return
    logAgentScrollEvent('footer_visibility', {
      showStreamingFooter,
      messagesCount: messages.length,
      offsetY: Math.round(scrollOffsetRef.current)
    })
    prevShowStreamingFooterRef.current = showStreamingFooter
  }, [showStreamingFooter, messages.length, scrollOffsetRef])

  useEffect(() => {
    setAgentScrollDebugContext({
      visibleMessagesCount: messages.length
    })
  }, [messages.length])

  /** 与 bubbleTextStreaming 对齐：linger / hold 期间仍视为展示态，避免结束帧切组件 */
  const markdownPresentationActive =
    isStreaming || isStreamBridgeActive || streamPresentationLinger || holdLivePresentation

  /** 思考区左侧转圈：流式进行中且（纯思考阶段或尚无 token） */
  const streamingThinkLoading = useMemo(() => {
    if (!markdownPresentationActive) return false
    if (streamingReasoning.trim() && !streamingText.trim()) return true
    if (
      !streamingText.trim() &&
      !streamingReasoning.trim() &&
      !activeTool &&
      completedTools.length === 0
    ) {
      return true
    }
    return false
  }, [
    streamingReasoning,
    streamingText,
    markdownPresentationActive,
    activeTool,
    completedTools.length
  ])

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
    completedTools.length > 0 ||
    pendingEmojiAttachments.length > 0
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

  const bubbleTextStreaming = markdownPresentationActive

  const liveStreamProps = useMemo(
    () => ({
      content: streamingText,
      reasoning: streamingReasoning,
      isTextStreaming: bubbleTextStreaming,
      isThinkLoading: streamingThinkLoading,
      isThinkStreaming: false,
      activeToolName: activeToolDisplayName,
      completedTools: streamingCompletedTools,
      attachments: pendingEmojiAttachments.length > 0 ? pendingEmojiAttachments : undefined
    }),
    [
      streamingText,
      streamingReasoning,
      bubbleTextStreaming,
      streamingThinkLoading,
      activeToolDisplayName,
      streamingCompletedTools,
      pendingEmojiAttachments
    ]
  )

  /** 尚无正文时仅用 StreamingBubble 显示等待点；有内容后统一走 ChatBubble */
  const renderStreamingDots = useCallback(
    () => (
      <View key={LIVE_ASSISTANT_STREAM_KEY} style={styles.bubble}>
        <StreamingBubble
          text=""
          reasoning=""
          isReasoning={streamingThinkLoading}
          isThinkStreaming={false}
          isTextStreaming={bubbleTextStreaming}
          activeToolName={activeToolDisplayName}
          completedTools={streamingCompletedTools}
          attachments={pendingEmojiAttachments}
          aiProfile={chatAiProfile}
          invertMetaOverBackground={hasChatBackground}
        />
      </View>
    ),
    [
      bubbleTextStreaming,
      streamingThinkLoading,
      activeToolDisplayName,
      streamingCompletedTools,
      pendingEmojiAttachments,
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
      logAgentScrollEvent('hold_live_end_finalize_handoff', {
        offsetY: Math.round(scrollOffsetRef.current),
        messageId: lastMessage?.id,
        assistantPersistedInList,
        contentAnchorMinHeight: contentAnchorMinHeight ?? 0
      })
      finalizeContentHandoff()
      requestAnimationFrame(() => {
        setKeepLiveRowAfterHold(false)
      })
    }
    prevHoldLiveRef.current = holdLivePresentation
  }, [
    holdLivePresentation,
    finalizeContentHandoff,
    scrollOffsetRef,
    lastMessage?.id,
    assistantPersistedInList,
    contentAnchorMinHeight
  ])

  const listContentStyle = useMemo(() => {
    const showEmptyState = !isStreaming && !isStreamBridgeActive && messages.length === 0

    if (showEmptyState && listViewportHeight > 0) {
      // 空状态不再用 flex 撑满视口，避免输入栏升降时「开始和伙伴对话」跟着上下跑
      return styles.listContent
    }
    if (contentAnchorMinHeight != null) {
      return [styles.listContent, { minHeight: contentAnchorMinHeight }]
    }
    return styles.listContent
  }, [
    contentAnchorMinHeight,
    isStreamBridgeActive,
    isStreaming,
    listViewportHeight,
    messages.length
  ])

  const listFooter = useMemo(
    () => (
      <View>
        <Animated.View style={listSpacerAnimatedStyle} />
      </View>
    ),
    [listSpacerAnimatedStyle]
  )

  const emptyOffsetTop = useMemo(() => {
    if (listViewportHeight <= 0) return 96
    // 相对可视区域大致居中，并预留默认输入栏；高度固定后不随展开变化
    return Math.max(48, Math.round((listViewportHeight - 280) / 2) - 56)
  }, [listViewportHeight])

  const renderEmptyState = () => (
    <View style={[styles.empty, { marginTop: emptyOffsetTop }]}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + '26' }]}>
        <Sparkles size={38} color={colors.primary} strokeWidth={2} style={{ opacity: 0.7 }} />
      </View>
      <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
        {t('agent.chat.start_chat', '开始和伙伴对话')}
      </Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
        {t('agent.chat.empty_hint', '试试问：「我这周写了什么日记？」')}
      </Text>
    </View>
  )

  return {
    showStreamingBubble,
    showStreamingTail,
    liveAssistantActive,
    keepLiveRowAfterHold,
    hasStreamingBody,
    chatRows,
    liveStreamProps,
    markdownPresentationActive,
    bubbleTextStreaming,
    streamingThinkLoading,
    streamingCompletedTools,
    renderStreamingDots,
    listContentStyle,
    listFooter,
    renderEmptyState,
    IDLE_LIVE_COMPRESSION
  }
}
