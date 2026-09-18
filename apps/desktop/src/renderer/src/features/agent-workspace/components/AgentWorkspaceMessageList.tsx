import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import {
  CompanionAskInteractionProvider,
  parseRedactedThinking,
  type AgentGateReplyPayload
} from '@baishou/ui'
import {
  type AgentGateRequest,
  type AgentStreamTimelineItem,
  type PromptFileRef,
  type WorkspaceChangeEntry
} from '@baishou/shared'
import type {
  WorkspaceChatMessage,
  PendingWorkspaceAssistantMsg
} from '../hooks/useWorkspaceChatMessages'
import type { WorkspaceToolError } from '../hooks/useWorkspaceAgentStream'
import {
  shouldShowStreamWaitingDots,
  streamTimelineHasRunningTool
} from '../utils/workspace-stream-waiting.util'
import { useChatScroll } from '../../agent/hooks/useChatScroll'
import { WorkspaceAssistantTurn } from './WorkspaceAssistantTurn'
import { WorkspaceUserTurn } from './WorkspaceUserTurn'
import { WorkspacePendingAssistantTurn, WorkspaceStreamingTurn } from './WorkspaceStreamingTurn'
import type { WorkspaceBubbleActions } from './workspace-bubble-actions.types'
import styles from './AgentWorkspaceMessageList.module.css'

export interface AgentWorkspaceMessageListProps {
  sessionId?: string
  messages: WorkspaceChatMessage[]
  pendingAssistantMsg?: PendingWorkspaceAssistantMsg | null
  streamingText?: string
  streamingReasoning?: string
  streamingTimeline?: AgentStreamTimelineItem[]
  isStreaming?: boolean
  /** 流结束后、落库前继续展示流式片段 */
  isBridgeActive?: boolean
  streamError?: string | null
  activeToolName?: string | null
  completedTools?: Array<{ name: string; durationMs: number; error?: string }>
  failedTools?: WorkspaceToolError[]
  assistantProfile?: {
    name: string
    avatarPath?: string | null
    emoji?: string | null
  }
  onEditResend?: (
    userMessageId: string,
    newText: string,
    meta?: {
      skillRefs?: Array<{ command: string; content: string }>
      fileRefs?: PromptFileRef[]
    }
  ) => boolean | Promise<boolean>
  bubbleActions?: WorkspaceBubbleActions
  onOpenFile?: (relativePath: string, options?: { line?: number; isDirectory?: boolean }) => void
  onSelectChange?: (change: WorkspaceChangeEntry) => void
  onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
  hasMore?: boolean
  onLoadMore?: () => Promise<void>
  pendingAsk?: AgentGateRequest | null
  isAskReplying?: boolean
  onAskReply?: (payload: AgentGateReplyPayload) => void | Promise<void>
}

export interface AgentWorkspaceMessageListHandle {
  beginFollowIfAtBottom: () => void
  scrollToBottom: () => void
}

export const AgentWorkspaceMessageList = forwardRef<
  AgentWorkspaceMessageListHandle,
  AgentWorkspaceMessageListProps
>(function AgentWorkspaceMessageList(
  {
    sessionId,
    messages,
    pendingAssistantMsg,
    streamingText = '',
    streamingReasoning = '',
    streamingTimeline = [],
    isStreaming = false,
    isBridgeActive = false,
    streamError = null,
    activeToolName = null,
    completedTools = [],
    failedTools = [],
    onEditResend,
    bubbleActions,
    onOpenFile,
    onSelectChange,
    onReviewAll,
    hasMore = false,
    onLoadMore,
    pendingAsk = null,
    isAskReplying = false,
    onAskReply
  },
  ref
) {
  const { t } = useTranslation()
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const activeTool = useMemo(
    () => (activeToolName ? { name: activeToolName, args: null } : null),
    [activeToolName]
  )
  const streamFollowKey = useMemo(
    () =>
      `${streamingTimeline.length}:${streamingTimeline.map((item) => item.kind).join(',')}:${isBridgeActive ? 1 : 0}`,
    [streamingTimeline, isBridgeActive]
  )
  const scroll = useChatScroll({
    sessionId,
    messages,
    streamingText,
    streamingReasoning,
    isStreaming: isStreaming || isBridgeActive,
    activeTool,
    streamFollowKey
  })

  useImperativeHandle(
    ref,
    () => ({
      beginFollowIfAtBottom: scroll.beginFollowIfAtBottom,
      scrollToBottom: scroll.scrollToBottom
    }),
    [scroll.beginFollowIfAtBottom, scroll.scrollToBottom]
  )

  useEffect(() => {
    setEditingMessageId(null)
  }, [sessionId])

  useEffect(() => {
    if (editingMessageId && !messages.some((msg) => msg.id === editingMessageId)) {
      setEditingMessageId(null)
    }
  }, [editingMessageId, messages])

  const loadMoreLockRef = useRef(false)
  const [showLoadMoreButton, setShowLoadMoreButton] = useState(false)
  const LOAD_MORE_TOP_THRESHOLD_PX = 120

  const syncLoadMoreVisibility = useCallback(() => {
    const el = scroll.scrollRef.current
    if (!el || !hasMore) {
      setShowLoadMoreButton(false)
      return
    }
    setShowLoadMoreButton(el.scrollTop < LOAD_MORE_TOP_THRESHOLD_PX)
  }, [hasMore, scroll.scrollRef])

  const triggerLoadMore = useCallback(() => {
    if (!hasMore || !onLoadMore || loadMoreLockRef.current) return
    const el = scroll.scrollRef.current
    loadMoreLockRef.current = true
    const prevHeight = el?.scrollHeight ?? 0
    void onLoadMore().finally(() => {
      requestAnimationFrame(() => {
        const pane = scroll.scrollRef.current
        if (pane) {
          pane.scrollTop = pane.scrollHeight - prevHeight
        }
        loadMoreLockRef.current = false
        syncLoadMoreVisibility()
      })
    })
  }, [hasMore, onLoadMore, scroll.scrollRef, syncLoadMoreVisibility])

  useEffect(() => {
    const el = scroll.scrollRef.current
    if (!el) return
    syncLoadMoreVisibility()
    el.addEventListener('scroll', syncLoadMoreVisibility, { passive: true })
    return () => el.removeEventListener('scroll', syncLoadMoreVisibility)
  }, [syncLoadMoreVisibility, messages.length, sessionId, scroll.scrollRef])

  useLayoutEffect(() => {
    syncLoadMoreVisibility()
  }, [syncLoadMoreVisibility, messages.length, isStreaming, isBridgeActive])

  const editingIndex = useMemo(() => {
    if (!editingMessageId) return -1
    return messages.findIndex((msg) => msg.id === editingMessageId)
  }, [editingMessageId, messages])

  const failedByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const tool of failedTools) {
      map.set(tool.name, tool.error)
    }
    for (const tool of completedTools) {
      if (tool.error) map.set(tool.name, tool.error)
    }
    return map
  }, [completedTools, failedTools])

  const lastMessage = messages[messages.length - 1]
  const assistantPersistedDuringBridge =
    isBridgeActive &&
    lastMessage?.role === 'assistant' &&
    Boolean(
      lastMessage.content?.trim() ||
      lastMessage.reasoning?.trim() ||
      (lastMessage.parts?.length ?? 0) > 0
    )
  const showStreamingBubble = (isStreaming || isBridgeActive) && !assistantPersistedDuringBridge
  const showPendingAssistant =
    !isStreaming &&
    !isBridgeActive &&
    Boolean(pendingAssistantMsg) &&
    !(
      lastMessage?.role === 'assistant' &&
      Boolean(
        lastMessage.content?.trim() ||
        lastMessage.reasoning?.trim() ||
        (lastMessage.parts?.length ?? 0) > 0
      )
    )

  const useLiveTimeline = streamingTimeline.length > 0
  const streamingParsed = useMemo(
    () => parseRedactedThinking(streamingText, streamingReasoning),
    [streamingText, streamingReasoning]
  )

  const streamingCompletedTools = useMemo(
    () => [
      ...completedTools.map((tool) => ({
        name: tool.name,
        durationMs: tool.durationMs,
        error: tool.error
      })),
      ...failedTools.map((tool) => ({
        name: tool.name,
        durationMs: 0,
        error: tool.error
      }))
    ],
    [completedTools, failedTools]
  )

  const handleAskReply = useCallback(
    (payload: AgentGateReplyPayload) => {
      void onAskReply?.(payload)
    },
    [onAskReply]
  )

  if (!sessionId || sessionId === 'new-session') {
    return (
      <div className={styles.scrollWrap}>
        <div className={styles.scroll} ref={scroll.scrollRef} data-workspace-chat-scroll="">
          <div className={styles.list} />
        </div>
      </div>
    )
  }

  const streamHasTimelineContent = useLiveTimeline
    ? streamingTimeline.some((item) => {
        if (item.kind === 'tool') return true
        return Boolean(item.text.trim())
      })
    : false
  const streamHasTools =
    streamingCompletedTools.some((tool) => !tool.error) || Boolean(activeToolName)
  const streamHasReasoning =
    streamingParsed.cleanReasoning.length > 0 ||
    Boolean(streamingReasoning && !streamingParsed.cleanContent)
  const streamHasText = streamingParsed.cleanContent.length > 0
  const lastTimelineItem = useLiveTimeline
    ? streamingTimeline[streamingTimeline.length - 1]
    : undefined
  const lastItemIsLiveText =
    isStreaming &&
    !isBridgeActive &&
    ((lastTimelineItem?.kind === 'text' && Boolean(lastTimelineItem.text.trim())) ||
      (lastTimelineItem?.kind === 'reasoning' && Boolean(lastTimelineItem.text.trim())) ||
      (!useLiveTimeline && (streamHasText || Boolean(streamingReasoning))))
  // 工具/确认门禁之后模型尚未吐字时，仍显示等待点，避免「卡住了」的空窗。
  // 工具行已有转动指示时不再叠底部三点。
  const streamShowWaiting = shouldShowStreamWaitingDots({
    isStreaming,
    isBridgeActive,
    streamError,
    lastItemIsLiveText,
    hasRunningTool: streamTimelineHasRunningTool(streamingTimeline, activeToolName)
  })
  const streamShowPlaceholder =
    streamShowWaiting &&
    !(useLiveTimeline
      ? streamHasTimelineContent
      : streamHasText || streamHasTools || streamHasReasoning)

  const isEditingTurn = Boolean(editingMessageId)

  return (
    <CompanionAskInteractionProvider
      pending={pendingAsk}
      isReplying={isAskReplying}
      onReply={handleAskReply}
    >
      <div className={styles.scrollWrap}>
        <div className={styles.scroll} ref={scroll.scrollRef} data-workspace-chat-scroll="">
          <div className={styles.list}>
            {showLoadMoreButton ? (
              <button type="button" className={styles.loadMoreBanner} onClick={triggerLoadMore}>
                {t('agent.chat.load_earlier_messages', '加载更早对话')}
              </button>
            ) : null}
            {messages.length === 0 && !showStreamingBubble && !showPendingAssistant ? (
              <p className={styles.empty}>
                {t('workbench.chat_empty', '在下方输入，开始这一轮协作')}
              </p>
            ) : null}
            {messages.map((msg, index) => {
              if (msg.role === 'user') {
                return (
                  <WorkspaceUserTurn
                    key={msg.id}
                    msg={msg}
                    dimmed={editingIndex >= 0 && index > editingIndex}
                    editingActive={editingMessageId === msg.id}
                    onEditingChange={setEditingMessageId}
                    onEditResend={onEditResend}
                    bubbleActions={bubbleActions}
                    onOpenFile={onOpenFile}
                  />
                )
              }

              return (
                <WorkspaceAssistantTurn
                  key={msg.id}
                  msg={msg}
                  dimmed={editingIndex >= 0 && index > editingIndex}
                  editingActive={editingMessageId === msg.id}
                  onEditingChange={setEditingMessageId}
                  onSelectChange={onSelectChange}
                  onReviewAll={onReviewAll}
                  bubbleActions={bubbleActions}
                  suppressIncompleteBanner={Boolean(pendingAsk)}
                />
              )
            })}

            {showStreamingBubble ? (
              <WorkspaceStreamingTurn
                dimmed={isEditingTurn}
                streamError={streamError}
                useLiveTimeline={useLiveTimeline}
                streamingTimeline={streamingTimeline}
                isStreaming={isStreaming}
                isBridgeActive={isBridgeActive}
                streamHasReasoning={streamHasReasoning}
                streamHasTools={streamHasTools}
                streamHasText={streamHasText}
                streamingParsed={streamingParsed}
                streamingReasoning={streamingReasoning}
                streamingCompletedTools={streamingCompletedTools}
                activeToolName={activeToolName}
                failedByName={failedByName}
                failedTools={failedTools}
                streamShowPlaceholder={streamShowPlaceholder}
                streamShowWaiting={streamShowWaiting}
                onSelectChange={onSelectChange}
                onReviewAll={onReviewAll}
              />
            ) : null}

            {showPendingAssistant && pendingAssistantMsg ? (
              <WorkspacePendingAssistantTurn
                dimmed={isEditingTurn}
                pendingAssistantMsg={pendingAssistantMsg}
              />
            ) : null}
          </div>
        </div>
        {scroll.showScrollButton ? (
          <button
            type="button"
            className={styles.scrollBottomBtn}
            onClick={scroll.scrollToBottom}
            title={t('workbench.scroll_to_bottom', '回到底部')}
            aria-label={t('workbench.scroll_to_bottom', '回到底部')}
          >
            <ChevronDown size={18} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
    </CompanionAskInteractionProvider>
  )
})
